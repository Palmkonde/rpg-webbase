import { readSummary, reportOf } from '../src/summary.ts'
import type { Summary } from '../src/summary.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const NOTHING: Summary = { flags: [], onceFlags: [], companions: [], zones: [], entities: [] }

test('a renamed Flag is one removal and one addition', () => {
  const { text, changed } = reportOf({ ...NOTHING, flags: ['met'] }, { ...NOTHING, flags: ['met_guard'] })

  assert.ok(changed)
  assert.match(text, /Flags:\n {2}\+ met_guard\n {2}- met$/u)
})

test('each kind of change is listed under its own heading', () => {
  const live = { ...NOTHING, onceFlags: ['seen_intro'], companions: ['Guard'], zones: ['Gate'] }

  const { text } = reportOf(live, { ...NOTHING, onceFlags: ['seen_start'], companions: ['Mage'], zones: ['Door'], entities: ['Mage'] })

  assert.match(text, /Once-only Cutscene Flags:\n {2}\+ seen_start\n {2}- seen_intro/u)
  assert.match(text, /Companion movers:\n {2}\+ Mage\n {2}- Guard/u)
  assert.match(text, /Zones:\n {2}\+ Door\n {2}- Gate/u)
})

test('movers with no Entity on any Map are named, and are not a change on their own', () => {
  const same = { ...NOTHING, companions: ['Guard'] }

  const { text, changed } = reportOf(same, same)

  assert.equal(changed, false)
  assert.equal(text, 'Movers with no Entity on any Map: Guard')
})

test('a World Version whose summary was stored as {} reads as empty', () => {
  assert.deepEqual(readSummary({}), NOTHING)
  assert.deepEqual(readSummary({ flags: 'met', zones: ['Gate', 1] }), { ...NOTHING, zones: ['Gate'] })
})

test('an unchanged World reports nothing', () => {
  assert.deepEqual(reportOf(NOTHING, NOTHING), { text: '', changed: false })
})
