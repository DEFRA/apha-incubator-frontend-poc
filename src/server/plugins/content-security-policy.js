import Blankie from 'blankie'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    connectSrc: [
      'self',
      'wss',
      'data:',
      'https://tiles.openfreemap.org',
      // Vite dev server HMR websocket
      'ws://localhost:24678'
    ],
    mediaSrc: ['self'],
    // 'unsafe-inline' is required as MapLibre GL (used to render the latest
    // cases map) applies inline styles dynamically via JS. Per the CSP spec,
    // 'unsafe-inline' is ignored by browsers when a hash-source is also
    // present in the same directive, so the previous Plotly-specific
    // sha256 hash (for its empty <style> element, populated via
    // CSSStyleSheet.insertRule) had to be dropped in favour of
    // 'unsafe-inline', which also covers that case.
    styleSrc: ['self', "'unsafe-inline'"],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    ],
    imgSrc: ['self', 'data:', 'https://tiles.openfreemap.org'],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    // MapLibre GL runs its tile parsing in a worker loaded from a blob URL
    workerSrc: ['self', 'blob:'],
    generateNonces: false
  }
}

export { contentSecurityPolicy }
