import { X, check, expectError, expectPass } from './helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const STORY = 'worlds/demo/scripts/story.clsc'

test('a compile error names the file and line', async () => {
  expectError(await check({ [STORY]: 'speaker A;\non interact(Sign) with A {\n    B: "x";\n}\n' }), `${STORY}:3`, 'unknown Speaker `B`')
})

test('a String Table key the table lacks is reported', async () => {
  const script = 'speaker A;\non interact(Sign) with A {\n    A: @missing.key;\n}\n'
  const strings = JSON.stringify({ locale: 'en', table: { en: { 'other.key': 'x' } } })
  expectError(await check({ [STORY]: script, 'worlds/demo/strings.json': strings }), `${STORY}:3`, '@missing.key')
})

test('a strings.json that is not a String Table is reported', async () => {
  expectError(await check({ 'worlds/demo/strings.json': '[]' }), 'worlds/demo/strings.json', 'a String Table is a JSON object')
})

test('a prelude.clsc of the Author’s own is refused', async () => {
  expectError(await check({ 'worlds/demo/scripts/prelude.clsc': 'enum Expression { Neutral }\n' }), 'worlds/demo/scripts/prelude.clsc', 'crpg ships prelude.clsc')
})

test('a Script in a nested folder compiles against the bundled prelude', async () => {
  expectPass(await check({ 'worlds/demo/scripts/story/more.clsc': 'cutscene hello with Player {\n    move(Player, (1, 1));\n}\n' }))
})

test('a Script that does not parse reports only its own error, not Portraits it hides', async () => {
  const run = await check({ [STORY]: 'not a script\n', 'worlds/demo/portraits/Ghost/happy.png': X })
  expectError(run, `${STORY}:1`)
  assert.ok(!run.output.includes('Ghost'), run.output)
})
