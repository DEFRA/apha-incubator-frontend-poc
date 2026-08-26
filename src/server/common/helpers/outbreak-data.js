import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.resolve(dirname, '../../data/outbreak-sample-data.json')

const outbreakData = Object.freeze(JSON.parse(readFileSync(dataPath, 'utf-8')))

/**
 * The synthetic outbreak dataset used by the charting library prototypes.
 * Read and parsed once at module load, then shared by every request.
 */
export function getOutbreakData() {
  return outbreakData
}
