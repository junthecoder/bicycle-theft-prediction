"""Pydantic response models. `uv run export-openapi` turns these into backend/openapi.json, from which
the frontend generates its TypeScript client, so every API payload must be declared here."""

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class Ward(BaseModel):
    code: str = Field(description="5-digit municipality code, e.g. 40131 for 東区")
    name: str
    population: int
    areas: int = Field(description="Number of 町丁目 in the ward")


class Meta(BaseModel):
    date_min: date = Field(description="First date the time slider should offer")
    date_max: date = Field(description="Last date with theft records")
    population_year: int = Field(description="Census year the population figures come from")
    city_thefts: int = Field(description="Theft records inside Fukuoka city")
    mapped_thefts: int = Field(description="City records that could be assigned to a 町丁目")
    total_population: int
    min_population_for_rate: int = Field(description="Areas with fewer residents get no per-capita rate")
    wards: list[Ward]


class AreaProperties(BaseModel):
    key_code: str = Field(description="11-digit census KEY_CODE; also the GeoJSON feature id")
    ward_code: str
    ward: str
    name: str
    name_normalized: str
    population: int
    households: int
    area_km2: float
    lon: float
    lat: float


class AreaFeature(BaseModel):
    type: Literal["Feature"]
    geometry: dict[str, Any]
    properties: AreaProperties


class AreaFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[AreaFeature]


class Window(BaseModel):
    start: date
    end: date
    days: int
    hour_from: int
    hour_to: int = Field(description="Inclusive; when smaller than hour_from the range wraps past midnight")


class AreaCount(BaseModel):
    key_code: str
    count: int
    prev_count: int = Field(description="Count in the window of the same length immediately before")
    rate: float | None = Field(description="Thefts per 1,000 residents; null where too few people live")


class AreaCounts(BaseModel):
    window: Window
    total: int = Field(description="City-wide thefts in the window")
    unmapped: int = Field(description="Thefts in the window that could not be placed in a 町丁目")
    areas: list[AreaCount] = Field(description="Only areas with at least one theft in either window")


class CategoryCount(BaseModel):
    label: str
    count: int


class Summary(BaseModel):
    window: Window
    key_code: str | None = Field(description="null for the city-wide summary")
    name: str
    ward: str | None
    population: int
    total: int
    prev_total: int
    rate: float | None = Field(description="Thefts per 1,000 residents over the window")
    by_hour: list[int] = Field(description="24 counts indexed by hour of day")
    unknown_hour: int
    by_weekday: list[int] = Field(description="7 counts, Monday first")
    locked: int
    unlocked: int
    by_place: list[CategoryCount]
    bicycle_parking: int = Field(description="Thefts from 駐車（輪）場 as opposed to anywhere else")
    by_age: list[CategoryCount]
    top_koban: list[CategoryCount] = Field(description="管轄交番・駐在所 with the most thefts")


class TimelinePoint(BaseModel):
    month: date = Field(description="First day of the month")
    count: int


class Timeline(BaseModel):
    hour_from: int
    hour_to: int
    key_code: str | None
    points: list[TimelinePoint]
