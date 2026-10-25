# Fukuoka Bicycle Thefts Prediction

## Layout

- `backend/`: Python (uv) data pipeline and model. Run commands from here, e.g. `uv run pipeline`.
- `frontend/`: React + TypeScript (pnpm, Vite). Run `pnpm dev` from here.
- `data/`: raw and processed data, shared by both (not tracked).

## Dataset

### Boundary data

#### Download page
https://www.e-stat.go.jp/gis/statmap-search?page=1&type=2&aggregateUnitForBoundary=A&toukeiCode=00200521&toukeiYear=2020&serveyId=A002005212020&prefCode=40&coordsys=1&format=shape&datum=2011

#### Download links 

40131	福岡市東区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40131&coordSys=1&format=shape&downloadType=5&datum=2011
40132	福岡市博多区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40132&coordSys=1&format=shape&downloadType=5&datum=2011
40133	福岡市中央区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40133&coordSys=1&format=shape&downloadType=5&datum=2011
40134	福岡市南区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40134&coordSys=1&format=shape&downloadType=5&datum=2011
40135	福岡市西区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40135&coordSys=1&format=shape&downloadType=5&datum=2011
40136	福岡市城南区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40136&coordSys=1&format=shape&downloadType=5&datum=2011
40137	福岡市早良区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40137&coordSys=1&format=shape&downloadType=5&datum=2011

### Population data

#### Download page
https://www.e-stat.go.jp/gis/statmap-search?page=2&type=1&toukeiCode=00200521&toukeiYear=2020&aggregateUnit=A&serveyId=A002005212020&statsId=T001082

#### Download link
https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001082&code=40&downloadType=2

### PMTiles

Run `uv run download-pmtiles` in `backend/` to download PMTiles for Fukuoka city.
