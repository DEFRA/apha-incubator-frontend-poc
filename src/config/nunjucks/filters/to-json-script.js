/**
 * Serialises a value for embedding in a `<script type="application/json">` tag.
 * `<` is escaped so the payload can never terminate the script element early.
 * @param {unknown} value
 * @returns {string}
 */
export function toJsonScript(value) {
  return JSON.stringify(value ?? null).replaceAll('<', '\\u003c')
}
