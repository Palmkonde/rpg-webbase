#!/usr/bin/env node
import { PublishError, connect } from './service.ts'
import type { Checked } from './world.ts'
import type { Context } from './problem.ts'
import type { PublishService } from './service.ts'
import type { Published } from './publish.ts'
import { checkWorld } from './world.ts'
import { formatProblem } from './problem.ts'
import { isDirectory } from './files.ts'
import { publishWorld } from './publish.ts'

const USAGE = `crpg: check and publish a World

Usage: crpg publish <world> [--dry-run] [--new]

  --dry-run  check the World and upload nothing
  --new      create the World: a World's first Publish needs it, and no other does

Run it from the content root, the folder holding library/ and worlds/.
Publishing reads GAME_SERVICE_URL (the Game Service) and PUBLISH_KEY (its shared Publish key) from the environment.`

const FLAGS = new Set(['--dry-run', '--new'])

function fail(message: string, code = 2): number {
  process.stderr.write(`crpg: ${message}\n`)
  return code
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// Prints what the checks found and says whether the World has any errors.
function report(world: string, { problems }: Checked): { errors: number; summary: string } {
  const errors = problems.filter((problem) => problem.severity === 'error').length
  for (const problem of problems) {
    process.stderr.write(`${formatProblem(problem)}\n`)
  }
  return { errors, summary: `Checked World "${world}": ${plural(errors, 'error')}, ${plural(problems.length - errors, 'warning')}.` }
}

async function reportDryRun(world: string, root: string): Promise<number> {
  const { errors, summary } = report(world, await checkWorld(root, world))
  process.stdout.write(`${summary} Dry run: nothing was uploaded.\n`)
  return errors === 0 ? 0 : 1
}

// The Game Service the environment names, or `undefined` while a setting is missing.
function serviceFromEnvironment(): PublishService | undefined {
  // oxlint-disable-next-line node/no-process-env -- the one place the CLI reads its settings.
  const { GAME_SERVICE_URL: serviceUrl, PUBLISH_KEY: publishKey } = process.env
  return serviceUrl && publishKey ? connect(serviceUrl, publishKey) : undefined
}

function describe(world: string, { version, uploaded, total }: Published): string {
  return `Published World "${world}": version ${version} is live. Uploaded ${uploaded} of ${plural(total, 'file')}; the rest were already on the service.`
}

async function publishChecked(context: Context, isNew: boolean, checked: Checked): Promise<number> {
  const service = serviceFromEnvironment()
  if (service === undefined) {
    return fail('publishing needs GAME_SERVICE_URL (the Game Service) and PUBLISH_KEY (its Publish key) in the environment')
  }
  try {
    process.stdout.write(`${describe(context.worldId, await publishWorld(context, checked, { isNew, service }))}\n`)
    return 0
  } catch (error) {
    if (error instanceof PublishError) {return fail(error.message, 1)}
    throw error
  }
}

async function publish(world: string, root: string, isNew: boolean): Promise<number> {
  const checked = await checkWorld(root, world)
  const { errors, summary } = report(world, checked)
  process.stdout.write(`${summary}\n`)
  if (errors > 0) {
    process.stdout.write('Nothing was uploaded.\n')
    return 1
  }
  return publishChecked({ root, worldId: world }, isNew, checked)
}

async function inContentRoot(root: string): Promise<boolean> {
  return (await isDirectory(`${root}/library`)) && (await isDirectory(`${root}/worlds`))
}

async function main(args: string[]): Promise<number> {
  const [command, world, ...flags] = args
  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  if (command !== 'publish' || world === undefined || world.startsWith('-') || flags.some((flag) => !FLAGS.has(flag))) {
    return fail(`unexpected arguments \`${args.join(' ')}\`\n\n${USAGE}`)
  }
  if (!(await inContentRoot(process.cwd()))) {
    return fail(`${process.cwd()} is not a content root: run crpg in the folder that holds library/ and worlds/`)
  }
  return flags.includes('--dry-run') ? reportDryRun(world, process.cwd()) : publish(world, process.cwd(), flags.includes('--new'))
}

// A bin script nothing `require`s, so the top-level `await` can't trip a loader.
// oxlint-disable-next-line node/no-top-level-await
process.exitCode = await main(process.argv.slice(2)).catch((error: unknown) => fail(String(error)))
