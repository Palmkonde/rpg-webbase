import { t } from 'elysia'

// `<sha256 hex>.<extension>`: the key is the content hash, so the bytes behind it can never change (adr/0034).
const KEY = /^[0-9a-f]{64}\.[a-z0-9]{1,16}$/u

export const BlobsModel = {
  key: t.String({ pattern: KEY.source }),
  keys: t.Object({ keys: t.Array(t.String({ pattern: KEY.source }), { maxItems: 10_000 }) }),
}
