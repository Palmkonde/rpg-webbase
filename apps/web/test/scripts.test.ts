import assert from 'node:assert/strict'
import { createScript } from '../src/scripts/script.ts'
import { runEntityScript } from '../src/scripts/run-entity-script.ts'
import { test } from 'node:test'

test('createScript builds Dialogue from chained say() calls, in order', () => {
  const dialogue = createScript().say('Hello.').say('Nice day, isn\'t it?').build()
  assert.deepEqual(dialogue, { lines: ['Hello.', 'Nice day, isn\'t it?'] })
})

test('createScript with no say() calls builds an empty line list', () => {
  const dialogue = createScript().build()
  assert.deepEqual(dialogue, { lines: [] })
})

test('createScript with no choice() calls omits choices from the built Dialogue', () => {
  const dialogue = createScript().say('Hello.').build()
  assert.equal('choices' in dialogue, false)
})

test('createScript chains say() and choice() into lines plus a flat choices list', () => {
  const dialogue = createScript()
    .say('Howdy!')
    .choice('Nice to meet you!', 'talked_to_campfire')
    .build()
  assert.deepEqual(dialogue, {
    lines: ['Howdy!'],
    choices: [{ text: 'Nice to meet you!', flag: 'talked_to_campfire' }],
  })
})

test('createScript supports multiple choices in one flat round', () => {
  const dialogue = createScript()
    .choice('Yes', 'agreed')
    .choice('No', 'declined')
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Yes', flag: 'agreed' },
    { text: 'No', flag: 'declined' },
  ])
})

test('createScript supports a no-op choice with no Flag to set', () => {
  const dialogue = createScript().choice('Never mind').build()
  assert.deepEqual(dialogue.choices, [{ text: 'Never mind' }])
})

test('createScript mixes Flag-setting and no-op choices in the same round', () => {
  const dialogue = createScript()
    .choice('Yes', 'agreed')
    .choice('Never mind')
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Yes', flag: 'agreed' },
    { text: 'Never mind' },
  ])
})

test('runEntityScript finds and runs a Script by entityId naming convention', async () => {
  // Asserts shape, not exact copy — the demo Script's flavor text is content, free to change.
  const dialogue = await runEntityScript('CampFire', { flags: {} })
  assert.ok(dialogue)
  assert.ok(dialogue.lines.length > 0)
  assert.ok(dialogue.lines.every((line) => typeof line === 'string'))
})

test('runEntityScript returns undefined when no Script is authored for the entityId', async () => {
  const dialogue = await runEntityScript('no-such-entity', { flags: {} })
  assert.equal(dialogue, undefined)
})

test('runEntityScript threads ctx.flags into the Script, letting it branch and offer a Flag-setting choice', async () => {
  const first = await runEntityScript('CampFire', { flags: {} })
  assert.ok(first?.choices?.some((choice) => choice.flag === 'talked_to_campfire'))

  const second = await runEntityScript('CampFire', { flags: { talked_to_campfire: true } })
  assert.equal(second?.choices, undefined)
})
