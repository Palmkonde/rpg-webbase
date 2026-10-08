import type { Context, Problem } from './problem.ts'
import { cgProblems, characterProblems, handlerProblems } from './references.ts'
import { filesUnder, isDirectory, isFile } from './files.ts'
import type { CharacterRef } from './references.ts'
import type { Maps } from './maps.ts'
import type { ScriptFacts } from './clsc.ts'
import { checkMaps } from './maps.ts'
import { compileScripts } from './clsc.ts'
import { errorAt } from './problem.ts'
import { portraitProblems } from './portraits.ts'
import { readFile } from 'node:fs/promises'
import { worldJsonChecks } from './world-json.ts'

async function readSources(context: Context, scripts: string): Promise<{ sources: [string, string][]; problems: Problem[] }> {
  const found = await filesUnder(`${context.root}/${scripts}`)
  const files = found.filter((name) => name.endsWith('.clsc'))
  const sources = await Promise.all(files.filter((file) => file !== 'prelude.clsc').map(async (file): Promise<[string, string]> => [file, await readFile(`${context.root}/${scripts}/${file}`, 'utf8')]))
  const own = files.includes('prelude.clsc') ? [errorAt(`${scripts}/prelude.clsc`, 'is not allowed: crpg ships prelude.clsc, so remove this file')] : []
  return { sources, problems: own }
}

async function readStrings(context: Context, file: string): Promise<string | undefined> {
  return (await isFile(`${context.root}/${file}`)) ? readFile(`${context.root}/${file}`, 'utf8') : undefined
}

// The compiler names the String Table as `strings.json: …` when that is what it couldn't read.
function fatalProblem(fatal: string, stringsFile: string, scripts: string): Problem {
  const prefix = 'strings.json: '
  return fatal.startsWith(prefix) ? errorAt(stringsFile, fatal.slice(prefix.length)) : errorAt(scripts, fatal)
}

interface ScriptChecks {
  problems: Problem[]
  characters: CharacterRef[]

  // The CGs the Scripts declare, and the bytecode of every Script, for Publish.
  cgs: string[]
  bytecode: Uint8Array | undefined
  facts: ScriptFacts | undefined
}

async function scriptChecks(context: Context, maps: Maps): Promise<ScriptChecks> {
  const scripts = `worlds/${context.worldId}/scripts`
  const stringsFile = `worlds/${context.worldId}/strings.json`
  const { sources, problems } = await readSources(context, scripts)
  const compiled = await compileScripts(scripts, sources, await readStrings(context, stringsFile))
  if ('fatal' in compiled) {
    return { problems: [...problems, fatalProblem(compiled.fatal, stringsFile, scripts)], characters: [], cgs: [], bytecode: undefined, facts: undefined }
  }

  const facts = compiled.parsed ? compiled.facts : undefined
  const references = facts === undefined ? [] : [...(await cgProblems(context, facts)), ...handlerProblems(facts, maps)]
  return {
    problems: [...problems, ...compiled.problems, ...references, ...(await portraitProblems(context, facts))],
    characters: (facts?.characters ?? []).map(({ name, path, line }) => ({ id: name, file: path, line, who: 'declares' })),
    cgs: [...new Set((facts?.cgs ?? []).map(({ name }) => name))],
    bytecode: compiled.bytecode,
    facts,
  }
}

// What the checks learned about a World besides its problems: what Publish needs to bundle it.
export interface Checked {
  problems: Problem[]
  maps: Maps
  characterIds: string[]
  cgs: string[]
  bytecode: Uint8Array | undefined
  facts: ScriptFacts | undefined
}


export async function checkWorld(root: string, worldId: string): Promise<Checked> {
  const context = { root, worldId }
  if (!/^[a-z0-9_-]+$/u.test(worldId) || !(await isDirectory(`${root}/worlds/${worldId}`))) {
    return { problems: [errorAt(`worlds/${worldId}`, 'is not a World folder (ids are lower-case a-z, 0-9, - and _)')], maps: { byId: new Map(), complete: false }, characterIds: [], cgs: [], bytecode: undefined, facts: undefined }
  }

  const { maps, problems: mapProblems } = await checkMaps(context)
  const worldJson = await worldJsonChecks(context, maps)
  const scripts = await scriptChecks(context, maps)
  const onMaps = [...maps.byId.values()].flatMap((map) =>
    map.characters.map((id) => ({ id, file: `worlds/${worldId}/maps/${map.id}.tmj`, who: `Map "${map.id}" has an Entity of` })),
  )
  const refs = [...onMaps, ...worldJson.characters, ...scripts.characters]
  const characters = await characterProblems(context, refs)
  return {
    problems: [...mapProblems, ...worldJson.problems, ...scripts.problems, ...characters],
    maps,
    characterIds: [...new Set(refs.map(({ id }) => id))],
    cgs: scripts.cgs,
    bytecode: scripts.bytecode,
    facts: scripts.facts,
  }
}
