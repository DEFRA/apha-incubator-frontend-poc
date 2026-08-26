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
    connectSrc: ['self', 'wss', 'data:'],
    mediaSrc: ['self'],
    // Plotly.js creates an empty <style> element via document.createElement('style')
    // + document.head.appendChild, then populates it using CSSStyleSheet.insertRule.
    // The hash is computed over the element's text content *at insertion time* (empty
    // string ""). insertRule calls after insertion are not subject to style-src CSP.
    // This hash is pinned to plotly.js-basic-dist-min@4.0.0, which creates exactly one
    // style element with empty initial text. Update if Plotly ever switches to
    // textContent-based injection or changes the number of style elements it creates.
    // sha256 of "": openssl dgst -sha256 -binary <(echo -n "") | base64
    styleSrc: ['self', "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='"],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    ],
    imgSrc: ['self', 'data:'],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    generateNonces: false
  }
}

export { contentSecurityPolicy }
