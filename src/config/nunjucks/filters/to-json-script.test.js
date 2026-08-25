import { toJsonScript } from './to-json-script.js'

describe('#toJsonScript', () => {
  test('Should serialise a value as JSON', () => {
    expect(toJsonScript({ labels: ['a'], values: [1] })).toBe(
      '{"labels":["a"],"values":[1]}'
    )
  })

  test('Should escape angle brackets so the script tag cannot be closed early', () => {
    expect(toJsonScript({ name: '</script><script>alert(1)</script>' })).toBe(
      '{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}'
    )
  })

  test('Should serialise missing values as null', () => {
    expect(toJsonScript(undefined)).toBe('null')
  })
})
