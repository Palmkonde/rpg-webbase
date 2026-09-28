import type { CutsceneEvent, CutsceneRunnerState } from '../src/state/cutscene-runner.ts'
import type { CutsceneStep } from '../src/state/cutscene.ts'
import assert from 'node:assert/strict'
import { stepCutscene } from '../src/state/cutscene-runner.ts'
import { test } from 'node:test'

const STEPS: CutsceneStep[] = [
  { type: 'dialogue', line: { text: 'One.' } },
  { type: 'dialogue', line: { text: 'Two.' } },
  { type: 'dialogue', line: { text: 'Three.' } },
]

const ADVANCE: CutsceneEvent = { type: 'advance-click' }

test('stepCutscene advance-click moves to the next step', () => {
  const state: CutsceneRunnerState = { stepIndex: 0 }
  assert.deepEqual(stepCutscene(state, ADVANCE, STEPS), { stepIndex: 1, done: false })
})

test('stepCutscene advance-click on the last step reports done', () => {
  const state: CutsceneRunnerState = { stepIndex: 2 }
  assert.deepEqual(stepCutscene(state, ADVANCE, STEPS), { stepIndex: 3, done: true })
})

test('stepCutscene advance-click once already done stays at the step count instead of overshooting', () => {
  const state: CutsceneRunnerState = { stepIndex: 3 }
  assert.deepEqual(stepCutscene(state, ADVANCE, STEPS), { stepIndex: 3, done: true })
})

test('stepCutscene steps through a whole Dialogue-only sequence to a terminal done state', () => {
  let state: CutsceneRunnerState = { stepIndex: 0 }
  const progression = STEPS.map(() => {
    state = stepCutscene(state, ADVANCE, STEPS)
    return state.stepIndex
  })

  assert.deepEqual(progression, [1, 2, 3])
  assert.equal(stepCutscene(state, ADVANCE, STEPS).done, true)
})

const MOVE_FINISHED: CutsceneEvent = { type: 'move-finished' }

const MOVEMENT_STEPS: CutsceneStep[] = [
  { type: 'dialogue', line: { text: 'Come here.' } },
  { type: 'movement', charId: 'player', targetPos: { x: 3, y: 4 } },
  { type: 'dialogue', line: { text: 'Good.' } },
]

test('stepCutscene move-finished moves past a Movement step to the next one', () => {
  const state: CutsceneRunnerState = { stepIndex: 1 }
  assert.deepEqual(stepCutscene(state, MOVE_FINISHED, MOVEMENT_STEPS), { stepIndex: 2, done: false })
})

test('stepCutscene ignores advance-click while a Movement step is current', () => {
  const state: CutsceneRunnerState = { stepIndex: 1 }
  assert.deepEqual(stepCutscene(state, ADVANCE, MOVEMENT_STEPS), { stepIndex: 1, done: false })
})

test('stepCutscene ignores move-finished while a Dialogue step is current', () => {
  const state: CutsceneRunnerState = { stepIndex: 0 }
  assert.deepEqual(stepCutscene(state, MOVE_FINISHED, MOVEMENT_STEPS), { stepIndex: 0, done: false })
})

test('stepCutscene steps through a Dialogue/Movement/Dialogue sequence to a terminal done state', () => {
  let state: CutsceneRunnerState = { stepIndex: 0 }
  const events: CutsceneEvent[] = [ADVANCE, MOVE_FINISHED, ADVANCE]
  const progression = events.map((event) => {
    state = stepCutscene(state, event, MOVEMENT_STEPS)
    return state.stepIndex
  })

  assert.deepEqual(progression, [1, 2, 3])
  assert.equal(stepCutscene(state, ADVANCE, MOVEMENT_STEPS).done, true)
})
