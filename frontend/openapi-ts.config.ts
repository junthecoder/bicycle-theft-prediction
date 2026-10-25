import { defineConfig } from '@hey-api/openapi-ts'

// Reads the document written by `uv run export-openapi` in backend/ and regenerates src/client.
export default defineConfig({
  input: '../backend/openapi.json',
  output: 'src/client',
  plugins: ['@hey-api/client-fetch', '@hey-api/typescript', '@hey-api/sdk'],
})
