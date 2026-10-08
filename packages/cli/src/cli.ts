#!/usr/bin/env node
import { PublishError, connect } from './service.ts'
import { publishWorld, reportAgainst } from './publish.ts'
import type { Checked } from './world.ts'
import type { Context } from './problem.ts'
import type { PublishService } from './service.ts'
import type { Published } from './publish.ts'
import type { Report } from './summary.ts'
import { checkWorld } from './world.ts'
import { createInterface } from 'node:readline'
import { formatProblem } from './problem.ts'
import { isDirectory } from './files.ts'
import { once } from 'node:events'

const USAGE = `crpg: check and publish a World

Usage: crpg publish <world> [--dry-run] [--new] [--yes]

  --dry-run  check the World, print what a Publish would change for Students, and upload nothing
  --new      create the World: a World's first Publish needs it, and no other does
  --yes      go live without asking when the Publish adds or removes Flags, Zones or Companions

Run it from the content root, the folder holding library/ and worlds/.
Publishing reads GAME_SERVICE_URL (the Game Service) and PUBLISH_KEY (its shared Publish key) from the environment.`

const FLAGS = new Set(['--dry-run', '--new', '--yes'])

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

// The Game Service the environment names, or `undefined` while a setting is missing.
function serviceFromEnvironment(): PublishService | undefined {
  // oxlint-disable-next-line node/no-process-env -- the one place the CLI reads its settings.
  const { GAME_SERVICE_URL: serviceUrl, PUBLISH_KEY: publishKey } = process.env
  return serviceUrl && publishKey ? connect(serviceUrl, publishKey) : undefined
}

// Only `y` or `yes` goes ahead: anything else, and a closed stdin, is a no.
async function askToPublish(): Promise<boolean> {
  process.stdout.write('Publish anyway? [y/N] ')
  const lines = createInterface({ input: process.stdin })
  const [answer] = await Promise.race([once(lines, 'line'), once(lines, 'close')]) as [string | undefined]
  lines.close()
  return /^y(?:es)?$/iu.test(answer?.trim() ?? '')
}

function approver(yes: boolean): (report: Report) => Promise<boolean> {
  return async ({ text, changed }) => {
    process.stdout.write(`${text}\n`)
    return !changed || yes || askToPublish()
  }
}

async function previewPublish(service: PublishService, world: string, checked: Checked): Promise<number> {
  try {
    const preview = reportAgainst(await service.live(world), checked)
    const text = preview ? preview.text || 'The Publish changes nothing Students keep.' : 'A first Publish: nothing to compare with.'
    process.stdout.write(`${text}\n`)
    return 0
  } catch (error) {
    if (error instanceof PublishError) {return fail(error.message, 1)}
    throw error
  }
}

// Without service settings a dry run still checks the World, but has no live World Version to report against.
async function reportDryRun(world: string, root: string): Promise<number> {
  const checked = await checkWorld(root, world)
  const { errors, summary } = report(world, checked)
  process.stdout.write(`${summary} Dry run: nothing was uploaded.\n`)
  const service = serviceFromEnvironment()
  if (errors > 0) {return 1}
  if (service === undefined) {
    process.stdout.write('No GAME_SERVICE_URL and PUBLISH_KEY: the Pre-Publish report was skipped.\n')
    return 0
  }
  return previewPublish(service, world, checked)
}

function describe(world: string, { version, uploaded, total }: Published): string {
  return `Published World "${world}": version ${version} is live. Uploaded ${uploaded} of ${plural(total, 'file')}; the rest were already on the service.`
}

async function publishWithService(context: Context, checked: Checked, options: Parameters<typeof publishWorld>[2]): Promise<number> {
  try {
    const published = await publishWorld(context, checked, options)
    process.stdout.write(`${describe(context.worldId, published)}\n`)
    return 0
  } catch (error) {
    if (error instanceof PublishError) {return fail(error.message, 1)}
    throw error
  }
}

async function publishChecked(context: Context, options: { isNew: boolean; yes: boolean }, checked: Checked): Promise<number> {
  const service = serviceFromEnvironment()
  if (service === undefined) {
    return fail('publishing needs GAME_SERVICE_URL (the Game Service) and PUBLISH_KEY (its Publish key) in the environment')
  }
  return publishWithService(context, checked, { isNew: options.isNew, service, approve: approver(options.yes) })
}

async function publish(world: string, root: string, options: { isNew: boolean; yes: boolean }): Promise<number> {
  const checked = await checkWorld(root, world)
  const { errors, summary } = report(world, checked)
  process.stdout.write(`${summary}\n`)
  if (errors > 0) {
    process.stdout.write('Nothing was uploaded.\n')
    return 1
  }
  return publishChecked({ root, worldId: world }, options, checked)
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
  return flags.includes('--dry-run') ? reportDryRun(world, process.cwd()) : publish(world, process.cwd(), { isNew: flags.includes('--new'), yes: flags.includes('--yes') })
}

// A bin script nothing `require`s, so the top-level `await` can't trip a loader.
// oxlint-disable-next-line node/no-top-level-await
process.exitCode = await main(process.argv.slice(2)).catch((error: unknown) => fail(String(error)))
