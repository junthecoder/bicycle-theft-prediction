import { register } from 'tsx/esm/api'

register({ tsconfig: new URL('../tsconfig.app.json', import.meta.url).pathname })
