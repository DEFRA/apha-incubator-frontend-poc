import { addDays, format } from 'date-fns'

import { config } from '#/config/config.js'
import { createLogger } from '../logging/logger.js'
import { getFirstLevelDiseases, getGeoRegions } from './wahis-client.js'

const defaultLogger = createLogger()

const dateFormat = 'yyyy-MM-dd'

/**
 * Documented fallback `areaId`s for the WOAH "Europe" geo-region
 * (`pi/country/list-geo-region`), captured 2026-09-02. Used only if the
 * live lookup fails, since WAHIS ids are internal and could be reassigned.
 */
export const FALLBACK_EUROPE_AREA_IDS = [
  5, 6, 16, 27, 19, 26, 23, 105, 58, 62, 70, 76, 72, 148, 75, 59, 89, 95, 107,
  114, 111, 116, 138, 133, 136, 137, 150, 142, 141, 152, 170, 171, 184, 187,
  193, 194, 207, 210, 214, 215, 69, 203, 216, 41, 236, 79, 241, 57
]

/**
 * Documented fallback avian influenza `firstDiseases` ids from
 * `pi/disease/first-level-filters`, captured 2026-09-02:
 * 668 = HPAI (poultry), 671 = HPAI (non-poultry/wild birds),
 * 888 = LPAI transmissible to humans, 922 = HPAI (bovines).
 */
export const FALLBACK_AVIAN_INFLUENZA_DISEASE_IDS = [668, 671, 888, 922]

const avianInfluenzaNamePatterns = [/avian influenza/i, /influenza a virus/i]

let cachedEuropeAreaIds
let cachedEuropeAreaIdsExpiresAt = 0
let cachedDiseaseIds
let cachedDiseaseIdsExpiresAt = 0

function isFresh(expiresAt) {
  return Date.now() < expiresAt
}

/**
 * Resolves the `areaId`s that make up WOAH's own "Europe" geo-region via
 * `pi/country/list-geo-region`, falling back to the documented static list
 * if the lookup fails or no "Europe" entry is found. Cached for the
 * configured TTL.
 */
export async function resolveEuropeCountryIds({ logger = defaultLogger } = {}) {
  if (cachedEuropeAreaIds && isFresh(cachedEuropeAreaIdsExpiresAt)) {
    return cachedEuropeAreaIds
  }

  try {
    const regions = await getGeoRegions({ logger })
    const europe = regions.find(
      (region) => region.name?.trim().toLowerCase() === 'europe'
    )

    if (!europe?.countryIds?.length) {
      throw new Error('No "Europe" entry found in list-geo-region response')
    }

    cachedEuropeAreaIds = europe.countryIds
    cachedEuropeAreaIdsExpiresAt = Date.now() + config.get('wahis.cacheTtlMs')
    return cachedEuropeAreaIds
  } catch (error) {
    logger.warn({ err: error }, 'Falling back to the static Europe areaId list')
    return FALLBACK_EUROPE_AREA_IDS
  }
}

/**
 * Resolves the `firstDiseases` ids for avian influenza via
 * `pi/disease/first-level-filters`, matching on name, falling back to the
 * documented static ids if the lookup fails or no match is found. Cached
 * for the configured TTL.
 */
export async function resolveAvianInfluenzaDiseaseIds({
  logger = defaultLogger
} = {}) {
  if (cachedDiseaseIds && isFresh(cachedDiseaseIdsExpiresAt)) {
    return cachedDiseaseIds
  }

  try {
    const diseases = await getFirstLevelDiseases({ logger })
    const matches = diseases.filter((disease) =>
      avianInfluenzaNamePatterns.some((pattern) => pattern.test(disease.name))
    )
    const ids = matches.flatMap((disease) => disease.ids)

    if (!ids.length) {
      throw new Error(
        'No avian influenza entries found in first-level-filters response'
      )
    }

    cachedDiseaseIds = ids
    cachedDiseaseIdsExpiresAt = Date.now() + config.get('wahis.cacheTtlMs')
    return cachedDiseaseIds
  } catch (error) {
    logger.warn(
      { err: error },
      'Falling back to the static avian influenza disease id list'
    )
    return FALLBACK_AVIAN_INFLUENZA_DISEASE_IDS
  }
}

/**
 * Builds the `submissionDate` filter window for "the last 24 hours".
 * `submissionDate` is `yyyy-MM-dd` only and compared at midnight
 * by the upstream API, so a true rolling 24h window can't be expressed
 * server-side: `to` must be the day *after* today, and the caller is
 * expected to apply a Node-side timestamp cut against `now` (see
 * `latest-cases-data.js`).
 */
export function buildSubmissionDateWindow(now = new Date()) {
  return {
    from: format(addDays(now, -1), dateFormat),
    to: format(addDays(now, 1), dateFormat)
  }
}

/** Exposed for tests that reset module-level cache state between runs. */
export function resetLatestCasesFilterCache() {
  cachedEuropeAreaIds = undefined
  cachedEuropeAreaIdsExpiresAt = 0
  cachedDiseaseIds = undefined
  cachedDiseaseIdsExpiresAt = 0
}
