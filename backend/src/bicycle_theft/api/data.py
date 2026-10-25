"""In-memory dataset behind the API: Fukuoka city thefts joined to 町丁目, plus the queries the
endpoints answer. Everything fits comfortably in memory (about 34k theft rows)."""

from dataclasses import dataclass
from datetime import date, timedelta

import polars as pl

from bicycle_theft.api import schemas
from bicycle_theft.areas import CHOME_PATTERN, normalize_area_name
from bicycle_theft.areas import PARQUET_PATH as AREAS_PATH
from bicycle_theft.paths import PROCESSED_DIR

THEFTS_PATH = PROCESSED_DIR / "fukuoka_bicycle_thefts.parquet"
# 市区町村コード of the seven Fukuoka city wards all start with 4013.
FUKUOKA_CITY_PREFIX = "4013"
# The yearly CSVs start with 2018; the handful of earlier dates are incidents reported late,
# far too sparse to map.
SLIDER_START = date(2018, 1, 1)
POPULATION_YEAR = 2020
# Below this many residents a per-capita rate says more about the denominator than about theft
# (e.g. 中州 has ~70 residents and hundreds of thefts).
MIN_POPULATION_FOR_RATE = 100
FULL_DAY = (0, 23)
TOP_CATEGORIES = 6

RAW_COLUMNS = {
    "市区町村コード（発生地）": "city_code",
    "町丁目（発生地）": "area_name",
    "発生年月日（始期）": "date",
    "発生時（始期）": "hour",
    "施錠関係": "lock",
    "発生場所": "place_new",
    "発生場所の属性": "place_old",
    "発生場所の詳細": "place_detail",
    "被害者の年齢": "age",
    "管轄交番・駐在所（発生地）": "koban",
}


class InvalidWindow(ValueError):
    """The requested current and comparison dates cannot be represented."""


def area_lookup(areas: pl.DataFrame) -> dict[tuple[str, str], str]:
    # When two areas in a ward share a name (壱岐団地), send thefts to the more populous one.
    ordered = areas.sort(["population", "key_code"], descending=[True, False])
    lookup = {}
    for ward, name, key in zip(ordered["ward_code"], ordered["name_normalized"], ordered["key_code"], strict=True):
        lookup.setdefault((ward, name), key)
    return lookup


def match_area(lookup: dict[tuple[str, str], str], ward_code: str, name: str | None) -> str | None:
    if name is None:
        return None
    normalized = normalize_area_name(name)
    candidates = [normalized]
    # Several 町 were split into 丁目 after the 2020 census (北原１丁目 -> 北原), and some
    # police rows drop the 大字 prefix (元岡 -> 大字元岡).
    stripped = CHOME_PATTERN.sub("", normalized)
    if stripped != normalized:
        candidates.append(stripped)
    candidates.extend(f"大字{candidate}" for candidate in list(candidates))
    for candidate in candidates:
        if (ward_code, candidate) in lookup:
            return lookup[(ward_code, candidate)]
    return None


def load_thefts(areas: pl.DataFrame) -> pl.DataFrame:
    raw = pl.read_parquet(THEFTS_PATH)
    required = {name for name, alias in RAW_COLUMNS.items() if alias in {"city_code", "area_name", "date", "hour"}}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"theft dataset missing required columns: {sorted(missing)}")
    # A single legacy year may lack entire optional columns, not just null cells.
    raw = raw.with_columns(pl.lit(None, dtype=pl.String).alias(name) for name in RAW_COLUMNS if name not in raw.columns)
    raw = raw.select(list(RAW_COLUMNS)).rename(RAW_COLUMNS)
    city = raw.filter(pl.col("city_code").str.starts_with(FUKUOKA_CITY_PREFIX), pl.col("date").is_not_null())
    lookup = area_lookup(areas)
    pairs = city.select(ward_code=pl.col("city_code").str.slice(0, 5), area_name="area_name").unique()
    pairs = pairs.with_columns(
        key_code=pl.Series(
            [match_area(lookup, w, n) for w, n in zip(pairs["ward_code"], pairs["area_name"], strict=True)],
            dtype=pl.String,
        )
    )
    return (
        city.with_columns(ward_code=pl.col("city_code").str.slice(0, 5))
        .join(pairs, on=["ward_code", "area_name"], how="left", nulls_equal=True)
        .with_columns(
            # Newer files renamed 発生場所の属性 to 発生場所; only one of the two is filled per row.
            place=pl.coalesce("place_new", "place_old"),
            locked=pl.when(pl.col("lock") == "施錠した").then(True).when(pl.col("lock") == "施錠せず").then(False),
            weekday=pl.col("date").dt.weekday() - 1,  # polars: Monday=1 .. Sunday=7
        )
        .drop("city_code", "place_new", "place_old", "lock")
    )


def hour_filter(hour_from: int, hour_to: int) -> pl.Expr:
    if (hour_from, hour_to) == FULL_DAY:
        return pl.lit(True)  # keep rows whose hour is unknown
    if hour_from <= hour_to:
        return pl.col("hour").is_between(hour_from, hour_to)
    return (pl.col("hour") >= hour_from) | (pl.col("hour") <= hour_to)  # e.g. 22-5 wraps midnight


def date_filter(start: date, end: date) -> pl.Expr:
    return pl.col("date").is_between(start, end)


def top_counts(df: pl.DataFrame, column: str, limit: int = TOP_CATEGORIES) -> list[schemas.CategoryCount]:
    counts = df.drop_nulls(column).group_by(column).len().sort(["len", column], descending=[True, False])
    return [schemas.CategoryCount(label=label, count=count) for label, count in counts.head(limit).rows()]


def rate_per_1000(count: int, population: int) -> float | None:
    if population < MIN_POPULATION_FOR_RATE:
        return None
    return round(count / population * 1000, 2)


@dataclass
class Dataset:
    areas: pl.DataFrame
    thefts: pl.DataFrame

    @classmethod
    def load(cls) -> "Dataset":
        areas = pl.read_parquet(AREAS_PATH)
        return cls(areas=areas, thefts=load_thefts(areas))

    def population_of(self, key_code: str | None) -> int:
        if key_code is None:
            return int(self.areas["population"].sum())
        return int(self.areas.filter(pl.col("key_code") == key_code)["population"].sum())

    def meta(self) -> schemas.Meta:
        wards = (
            self.areas.group_by("ward_code", "ward")
            .agg(pl.col("population").sum(), pl.len().alias("areas"))
            .sort("ward_code")
        )
        # Judge by name rather than key_code: two census areas can share a name (壱岐団地) and
        # area_lookup() sends every theft under that name to one of them.
        recorded_names = self.areas.join(
            self.thefts.select("key_code").drop_nulls().unique(), on="key_code", how="semi"
        ).select("ward_code", "name_normalized")
        unrecorded = self.areas.join(recorded_names, on=["ward_code", "name_normalized"], how="anti")
        return schemas.Meta(
            date_min=SLIDER_START,
            date_max=self.thefts["date"].max(),
            population_year=POPULATION_YEAR,
            city_thefts=len(self.thefts),
            mapped_thefts=int(self.thefts["key_code"].is_not_null().sum()),
            total_population=self.population_of(None),
            min_population_for_rate=MIN_POPULATION_FOR_RATE,
            unrecorded_areas=unrecorded["key_code"].to_list(),
            wards=[
                schemas.Ward(code=code, name=name, population=int(pop), areas=int(n))
                for code, name, pop, n in wards.rows()
            ],
        )

    def window(self, end: date, days: int, hour_from: int, hour_to: int) -> schemas.Window:
        # Validate with integer ordinals before constructing timedelta, including the
        # preceding comparison window used by every aggregate endpoint.
        if days < 1 or days > end.toordinal() // 2:
            raise InvalidWindow("current and preceding windows must fit within years 1 through 9999")
        return schemas.Window(
            start=end - timedelta(days=days - 1), end=end, days=days, hour_from=hour_from, hour_to=hour_to
        )

    def in_window(self, window: schemas.Window, shift_back: bool = False) -> pl.DataFrame:
        start, end = window.start, window.end
        if shift_back:
            start, end = start - timedelta(days=window.days), start - timedelta(days=1)
        return self.thefts.filter(date_filter(start, end), hour_filter(window.hour_from, window.hour_to))

    def area_counts(self, window: schemas.Window) -> schemas.AreaCounts:
        current = self.in_window(window)
        previous = self.in_window(window, shift_back=True)
        counts = (
            current.drop_nulls("key_code")
            .group_by("key_code")
            .len("count")
            .join(
                previous.drop_nulls("key_code").group_by("key_code").len("prev_count"),
                on="key_code",
                how="full",
                coalesce=True,
            )
            .fill_null(0)
            .join(self.areas.select("key_code", "population"), on="key_code", how="left")
            .sort("key_code")
        )
        return schemas.AreaCounts(
            window=window,
            total=len(current),
            unmapped=int(current["key_code"].is_null().sum()),
            areas=[
                schemas.AreaCount(key_code=key, count=count, prev_count=prev, rate=rate_per_1000(count, population))
                for key, count, prev, population in counts.rows()
            ],
        )

    def summary(self, window: schemas.Window, key_code: str | None) -> schemas.Summary:
        current = self.in_window(window)
        previous = self.in_window(window, shift_back=True)
        if key_code is None:
            name, ward = "福岡市全域", None
        else:
            area = self.areas.filter(pl.col("key_code") == key_code)
            if area.is_empty():
                raise KeyError(key_code)
            name, ward = area["name"][0], area["ward"][0]
            current = current.filter(pl.col("key_code") == key_code)
            previous = previous.filter(pl.col("key_code") == key_code)
        population = self.population_of(key_code)
        by_hour = dict(current.drop_nulls("hour").group_by("hour").len().rows())
        by_weekday = dict(current.group_by("weekday").len().rows())
        return schemas.Summary(
            window=window,
            key_code=key_code,
            name=name,
            ward=ward,
            population=population,
            total=len(current),
            prev_total=len(previous),
            rate=rate_per_1000(len(current), population),
            by_hour=[int(by_hour.get(h, 0)) for h in range(24)],
            unknown_hour=int(current["hour"].is_null().sum()),
            by_weekday=[int(by_weekday.get(d, 0)) for d in range(7)],
            locked=int(current["locked"].fill_null(False).sum()),
            unlocked=int((~current["locked"]).fill_null(False).sum()),
            by_place=top_counts(current, "place"),
            bicycle_parking=int((current["place_detail"] == "駐車（輪）場").sum()),
            by_age=top_counts(current, "age"),
            top_koban=top_counts(current, "koban", limit=3),
        )

    def timeline(self, hour_from: int, hour_to: int, key_code: str | None) -> schemas.Timeline:
        if key_code is not None and not self.areas["key_code"].eq(key_code).any():
            raise KeyError(key_code)
        df = self.thefts.filter(pl.col("date") >= SLIDER_START, hour_filter(hour_from, hour_to))
        if key_code is not None:
            df = df.filter(pl.col("key_code") == key_code)
        monthly = df.group_by(pl.col("date").dt.truncate("1mo").alias("month")).len().sort("month")
        # Keep a common calendar axis even when the filter removes whole months.
        counts = dict(monthly.rows())
        last = self.thefts["date"].max()
        months = []
        month = SLIDER_START
        while last is not None and month <= last:
            months.append(schemas.TimelinePoint(month=month, count=counts.get(month, 0)))
            if month.year == 9999 and month.month == 12:
                break
            month = date(month.year + month.month // 12, month.month % 12 + 1, 1)
        return schemas.Timeline(
            hour_from=hour_from,
            hour_to=hour_to,
            key_code=key_code,
            points=months,
        )
