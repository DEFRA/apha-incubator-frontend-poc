import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest

function collectCss(entry, visited = new Set()) {
  if (!viteManifest?.[entry]) {
    return []
  }

  if (visited.has(entry)) {
    return []
  }

  visited.add(entry)

  const manifest = viteManifest[entry]
  const css = [...(manifest.css ?? [])]

  if (manifest.imports) {
    for (const importEntry of manifest.imports) {
      const importedCss = collectCss(importEntry, visited)
      for (const cssFile of importedCss) {
        if (!css.includes(cssFile)) {
          css.push(cssFile)
        }
      }
    }
  }

  return css
}

export function context(request) {
  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    },
    getAssetCss(entry) {
      if (!config.get('isProduction')) {
        return []
      }

      return collectCss(entry).map((css) => `${assetPath}/${css}`)
    }
  }
}
