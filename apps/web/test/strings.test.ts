import { currentLocale, resolveLine } from '../src/state/strings.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const table = {
  en: { greeting: 'Hello' },
  th: { greeting: 'สวัสดี' },
}

test('resolveLine returns the text for a key that exists in the requested locale', () => {
  const result = resolveLine('greeting', 'th', table)
  assert.equal(result, 'สวัสดี')
})

test('resolveLine falls back to the default locale when the key is missing in the requested locale', () => {
  const partial = { en: { greeting: 'Hello' }, th: {} }
  const result = resolveLine('greeting', 'th', partial)
  assert.equal(result, 'Hello')
})

test('resolveLine falls back to the default locale for an unknown locale', () => {
  const result = resolveLine('greeting', 'fr', table)
  assert.equal(result, 'Hello')
})

test('resolveLine returns a visible placeholder when the key is missing everywhere', () => {
  const result = resolveLine('does-not-exist', 'en', table)
  assert.equal(result, '[does-not-exist]')
})

test('the default string table is wired to the real fixture, via the fixture-stubbed currentLocale', () => {
  const result = resolveLine('campfire.greeting', currentLocale)
  assert.equal(result, 'Howdy! am campfire!')
})
