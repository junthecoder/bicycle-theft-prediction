"""FastAPI service: serves the local PMTiles basemap, the 町丁目 GeoJSON and theft statistics.

Run with `uv run api`; the Vite dev server proxies /api and /tiles here."""

from contextlib import asynccontextmanager
from datetime import date
from typing import Annotated

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.routing import APIRoute

from bicycle_theft.api import schemas
from bicycle_theft.api.data import Dataset, InvalidWindow
from bicycle_theft.areas import CITY_GEOJSON_PATH, GEOJSON_PATH
from bicycle_theft.download_pmtiles import OUTPUT as PMTILES_PATH


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.dataset = Dataset.load()
    yield


def operation_id(route: APIRoute) -> str:
    # Use the handler name so the generated TypeScript SDK gets functions like `getMeta`.
    return route.name


app = FastAPI(
    title="Fukuoka Bicycle Theft API",
    version="0.1.0",
    lifespan=lifespan,
    generate_unique_id_function=operation_id,
)


@app.exception_handler(InvalidWindow)
async def invalid_window_handler(request: Request, exc: InvalidWindow):
    return JSONResponse(status_code=422, content={"detail": [{"type": "value_error", "loc": ["query", "days"], "msg": str(exc)}]})

EndDate = Annotated[date, Query(description="Last day of the window (inclusive)")]
# Bound only by Python's calendar; the frontend can still request all available data.
Days = Annotated[int, Query(ge=1, le=date.max.toordinal() // 2, description="Window length in days; current and previous windows must fit within years 1–9999")]
HourFrom = Annotated[int, Query(ge=0, le=23)]
HourTo = Annotated[int, Query(ge=0, le=23, description="Inclusive; smaller than hour_from wraps past midnight")]
KeyCode = Annotated[str | None, Query(description="町丁目 KEY_CODE; omit for the whole city")]


def dataset(request: Request) -> Dataset:
    return request.app.state.dataset


@app.get("/tiles/fukuoka.pmtiles", include_in_schema=False)
def get_pmtiles() -> FileResponse:
    if not PMTILES_PATH.exists():
        raise HTTPException(404, f"{PMTILES_PATH} missing; run `uv run download-pmtiles`")
    # Starlette honours Range headers, which is all the pmtiles client needs. Browsers must
    # revalidate (ETag) rather than reuse cached ranges: after a fresh `download-pmtiles` the
    # cached header would point tiles at offsets of the old file.
    return FileResponse(PMTILES_PATH, media_type="application/octet-stream", headers={"Cache-Control": "no-cache"})


@app.get("/api/meta")
def get_meta(request: Request) -> schemas.Meta:
    return dataset(request).meta()


@app.get("/api/areas", response_model=schemas.AreaFeatureCollection)
def get_areas() -> FileResponse:
    if not GEOJSON_PATH.exists():
        raise HTTPException(404, f"{GEOJSON_PATH} missing; run `uv run build-areas`")
    return FileResponse(GEOJSON_PATH, media_type="application/geo+json")


@app.get("/api/city-outline", response_model=schemas.CityOutlineFeatureCollection)
def get_city_outline() -> FileResponse:
    if not CITY_GEOJSON_PATH.exists():
        raise HTTPException(404, f"{CITY_GEOJSON_PATH} missing; run `uv run build-areas`")
    return FileResponse(CITY_GEOJSON_PATH, media_type="application/geo+json")


@app.get("/api/thefts/by-area")
def get_area_counts(
    request: Request, end: EndDate, days: Days = 90, hour_from: HourFrom = 0, hour_to: HourTo = 23
) -> schemas.AreaCounts:
    ds = dataset(request)
    return ds.area_counts(ds.window(end, days, hour_from, hour_to))


@app.get("/api/thefts/summary", responses={404: {"description": "Unknown area"}})
def get_summary(
    request: Request,
    end: EndDate,
    days: Days = 90,
    hour_from: HourFrom = 0,
    hour_to: HourTo = 23,
    key_code: KeyCode = None,
) -> schemas.Summary:
    ds = dataset(request)
    try:
        return ds.summary(ds.window(end, days, hour_from, hour_to), key_code)
    except KeyError:
        raise HTTPException(404, f"unknown area {key_code}") from None


@app.get("/api/thefts/timeline", responses={404: {"description": "Unknown area"}})
def get_timeline(
    request: Request, hour_from: HourFrom = 0, hour_to: HourTo = 23, key_code: KeyCode = None
) -> schemas.Timeline:
    try:
        return dataset(request).timeline(hour_from, hour_to, key_code)
    except KeyError:
        raise HTTPException(404, f"unknown area {key_code}") from None


def main() -> None:
    uvicorn.run("bicycle_theft.api.app:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
