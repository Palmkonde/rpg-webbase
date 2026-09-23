import type { Dialogue } from '../src/scripts/script.ts'
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
    .choice('Nice to meet you!', { flags: { talked_to_campfire: true } })
    .build()
  assert.deepEqual(dialogue, {
    lines: ['Howdy!'],
    choices: [{ text: 'Nice to meet you!', flags: { talked_to_campfire: true } }],
  })
})

test('createScript supports multiple choices in one flat round', () => {
  const dialogue = createScript()
    .choice('Yes', { flags: { agreed: true } })
    .choice('No', { flags: { declined: true } })
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Yes', flags: { agreed: true } },
    { text: 'No', flags: { declined: true } },
  ])
})

test('createScript supports a no-op choice with no Flag to set', () => {
  const dialogue = createScript().choice('Never mind').build()
  assert.deepEqual(dialogue.choices, [{ text: 'Never mind' }])
})

test('createScript mixes Flag-setting and no-op choices in the same round', () => {
  const dialogue = createScript()
    .choice('Yes', { flags: { agreed: true } })
    .choice('Never mind')
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Yes', flags: { agreed: true } },
    { text: 'Never mind' },
  ])
})

test('createScript supports a choice that writes multiple Flags at once', () => {
  const dialogue = createScript()
    .choice('Nice to meet you!', { flags: { met_merchant: true, was_polite: true } })
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Nice to meet you!', flags: { met_merchant: true, was_polite: true } },
  ])
})

test('createScript supports a choice with a visible condition', () => {
  const dialogue = createScript()
    .choice('Secret option', { visible: false })
    .build()
  assert.deepEqual(dialogue.choices, [{ text: 'Secret option', visible: false }])
})

test('createScript supports a choice with an enabled condition and a disabledReason', () => {
  const dialogue = createScript()
    .choice('Buy the sword', { disabledReason: 'Not enough gold.', enabled: false })
    .build()
  assert.deepEqual(dialogue.choices, [
    { text: 'Buy the sword', disabledReason: 'Not enough gold.', enabled: false },
  ])
})

function caveRound(): Dialogue {
  return createScript().say('You arrive at a cave.').choice('Enter').build()
}

test('createScript supports a choice whose outcome returns another set of choices (nested tree)', () => {
  const dialogue = createScript()
    .say('Which path?')
    .choice('Go north', { next: caveRound })
    .build()

  const northChoice = dialogue.choices?.[0]
  assert.equal(typeof northChoice?.next, 'function')
  assert.deepEqual(northChoice?.next?.({ flags: {} }), {
    lines: ['You arrive at a cave.'],
    choices: [{ text: 'Enter' }],
  })
})

function sharedContinuation(): Dialogue {
  return createScript().say('You both end up here.').build()
}

test('createScript supports branch reconvergence: two choices share the same next function/closure', () => {
  const dialogue = createScript()
    .choice('Path A', { next: sharedContinuation })
    .choice('Path B', { next: sharedContinuation })
    .build()

  assert.equal(dialogue.choices?.[0].next, dialogue.choices?.[1].next)
  assert.deepEqual(dialogue.choices?.[0].next?.({ flags: {} }), dialogue.choices?.[1].next?.({ flags: {} }))
})

function roundThree(): Dialogue {
  return createScript().say('Round 3').build()
}
function roundTwo(): Dialogue {
  return createScript().say('Round 2').choice('Go deeper again', { next: roundThree }).build()
}

test('createScript supports a multi-level branching tree (three rounds deep)', () => {
  const dialogue = createScript().say('Round 1').choice('Go deeper', { next: roundTwo }).build()

  const secondRound = dialogue.choices?.[0].next?.({ flags: {} })
  assert.deepEqual(secondRound?.lines, ['Round 2'])
  const thirdRound = secondRound?.choices?.[0].next?.({ flags: {} })
  assert.deepEqual(thirdRound, { lines: ['Round 3'] })
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
  assert.ok(first?.choices?.some((choice) => choice.flags?.talked_to_campfire === true))

  const second = await runEntityScript('CampFire', { flags: { talked_to_campfire: true } })
  assert.ok(second?.choices && second.choices.length > 0)
})

test('runEntityScript: a choice hidden on first interaction becomes visible once its Flag is set', async () => {
  const first = await runEntityScript('CampFire', { flags: {} })
  const secretChoiceFirst = first?.choices?.find((choice) => choice.text === 'Ask what the campfire has seen')
  assert.equal(secretChoiceFirst?.visible, false)

  const second = await runEntityScript('CampFire', { flags: { was_polite_to_campfire: true } })
  const secretChoiceSecond = second?.choices?.find((choice) => choice.text === 'Ask what the campfire has seen')
  assert.equal(secretChoiceSecond?.visible, true)
})

test('runEntityScript: a choice can be visible but disabled with a reason', async () => {
  const dialogue = await runEntityScript('CampFire', { flags: {} })
  const firewoodChoice = dialogue?.choices?.find((choice) => choice.text === 'Warm your hands')
  assert.equal(firewoodChoice?.enabled, false)
  assert.equal(firewoodChoice?.disabledReason, 'You need firewood first.')
})
