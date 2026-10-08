#!/usr/bin/env node
import { checkWorld } from './world.ts'
import { formatProblem } from './problem.ts'
import { isDirectory } from './files.ts'

const USAGE = `crpg: check and publish a World

Usage: crpg publish <world> --dry-run

Run it from the content root, the folder holding library/ and worlds/.`

function fail(message: string): number {
  process.stderr.write(`crpg: ${message}\n`)
  return 2
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

async function reportDryRun(world: string, root: string): Promise<number> {
  const problems = await checkWorld(root, world)
  const errors = problems.filter((problem) => problem.severity === 'error').length
  for (const problem of problems) {
    process.stderr.write(`${formatProblem(problem)}\n`)
  }

  process.stdout.write(`Checked World "${world}": ${plural(errors, 'error')}, ${plural(problems.length - errors, 'warning')}. Dry run: nothing was uploaded.\n`)
  return errors === 0 ? 0 : 1
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
  if (command !== 'publish' || world === undefined || world.startsWith('-') || flags.some((flag) => flag !== '--dry-run')) {
    return fail(`unexpected arguments \`${args.join(' ')}\`\n\n${USAGE}`)
  }
  if (!flags.includes('--dry-run')) {
    return fail('publishing is not available yet; run with --dry-run to check the World')
  }
  return (await inContentRoot(process.cwd())) ? reportDryRun(world, process.cwd()) : fail(`${process.cwd()} is not a content root: run crpg in the folder that holds library/ and worlds/`)
}

// A bin script nothing `require`s, so the top-level `await` can't trip a loader.
// oxlint-disable-next-line node/no-top-level-await
process.exitCode = await main(process.argv.slice(2)).catch((error: unknown) => fail(String(error)))
