import { check, expectError, expectPass, mapWithObjects } from './helpers.ts'
import { test } from 'node:test'

const START = 'worlds/demo/maps/start.tmj'
const SCHOOL = 'worlds/demo/maps/school.tmj'

function portal(targetMap: string, targetSpawn: string): object {
  return {
    name: 'door',
    type: 'Portal',
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    properties: [{ name: 'targetMap', type: 'string', value: targetMap }, { name: 'targetSpawn', type: 'string', value: targetSpawn }],
  }
}

function spawnPoint(spawnId: string, x = 32, y = 32): object {
  return { name: spawnId, type: 'SpawnPoint', point: true, x, y, properties: [{ name: 'spawnId', type: 'string', value: spawnId }] }
}

test('two Maps joined both ways, each Portal aiming at a Spawn Point beside the other, pass', async () => {
  const start = mapWithObjects(portal('school', 'gate'), spawnPoint('back'))
  const school = mapWithObjects(portal('start', 'back'), spawnPoint('gate'))
  expectPass(await check({ [START]: start, [SCHOOL]: school }))
})

test('a Portal with no targetSpawn is refused', async () => {
  const blank = { ...portal('start', 'x'), properties: [{ name: 'targetMap', type: 'string', value: 'start' }] }
  const start = mapWithObjects(blank, spawnPoint('x'))
  expectError(await check({ [START]: start }), START, 'Portal with no targetSpawn')
})

test('a Portal whose target Map is not in the World is refused', async () => {
  const start = mapWithObjects(portal('nowhere', 'gate'))
  expectError(await check({ [START]: start }), START, 'Portal', '"nowhere"')
})

test('a Portal whose target Spawn Point is not on its target Map is refused', async () => {
  const start = mapWithObjects(portal('school', 'roof'))
  const school = mapWithObjects(spawnPoint('gate'))
  expectError(await check({ [START]: start, [SCHOOL]: school }), START, 'Spawn Point "roof"', 'Map "school"')
})

test('a spawnId repeated on one Map is refused', async () => {
  const school = mapWithObjects(spawnPoint('gate'), spawnPoint('gate', 64, 64))
  expectError(await check({ [SCHOOL]: school }), SCHOOL, 'Spawn Point id "gate"')
})

test('a Spawn Point outside its Map is refused', async () => {
  const school = mapWithObjects(spawnPoint('gate', 160, 32))
  expectError(await check({ [SCHOOL]: school }), SCHOOL, 'Spawn Point "gate"', '(5, 1)', '4x4')
})
