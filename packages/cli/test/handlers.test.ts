import { check, expectPass } from './helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const STORY = 'worlds/demo/scripts/story.clsc'

test('a handler naming an Entity on no Map is a warning, and the exit code stays 0', async () => {
  const run = await check({ [STORY]: 'speaker Sign;\non interact(Nobody) with Sign {\n    Sign: "x";\n}\n' })
  expectPass(run)
  assert.match(run.output, /warning: worlds\/demo\/scripts\/story\.clsc:2/u)
  assert.match(run.output, /Nobody/u)
  assert.match(run.output, /1 warning/u)
})

test('an on enter handler naming a Zone on no Map is a warning', async () => {
  const run = await check({ [STORY]: 'speaker Sign;\non enter(Nowhere) with Sign {\n    Sign: "x";\n}\n' })
  expectPass(run)
  assert.match(run.output, /Zone/u)
})
