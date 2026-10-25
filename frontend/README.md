# Fukuoka bicycle-theft map frontend

React/TypeScript, Vite and MapLibre. Use Node.js 24 and pnpm 12.15.0.

- `pnpm install --frozen-lockfile`: install the committed dependencies.
- `pnpm dev`: local UI; proxies `/api` and `/tiles` to the backend on port 8000.
- `pnpm test`: Node test runner, TSX and jsdom; no live API or GPU needed.
- `pnpm lint`: Oxlint.
- `pnpm build`: TypeScript checks and production assets in `dist/`.
- `pnpm generate:api`: regenerate `src/client/` from `../backend/openapi.json`.

The generated client must not be edited manually. The test loader uses the same automatic JSX transform as the application. Dependency build scripts are explicitly approved in `pnpm-workspace.yaml`.

Production requires a same-origin reverse proxy for `/api` and `/tiles`. See the [root README](../README.md) and [audit report](../docs/audit/README.md) for setup, contract changes and validation limits.
