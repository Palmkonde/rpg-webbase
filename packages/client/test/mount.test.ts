import assert from 'node:assert/strict'
import { test } from 'node:test'

// Phaser throws on import outside a browser, so this fails the moment the package imports it eagerly.
test('the client package imports outside a browser, loading no Phaser', async () => {
  const client = await import('../src/index.ts')

  assert.equal(typeof client.mount, 'function')
})
