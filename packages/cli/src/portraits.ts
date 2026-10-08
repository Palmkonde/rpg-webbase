import type { Context, Problem } from './problem.ts'
import { entries, extensionOf, isRaw, stemOf } from './files.ts'
import type { ScriptFacts } from './clsc.ts'
import { errorAt } from './problem.ts'

// The prelude's `enum Expression`, as the lower-case file names Portraits use (the prelude is bundled in the compiler, so the CLI can't read it).
const EXPRESSIONS = new Set(['neutral', 'happy', 'sad', 'angry', 'surprised'])

export interface PortraitFile {
  speaker: string
  fileName: string
}

// Every `portraits/<Speaker>/<name>.png`; `raw.*` and other file types are not Portraits.
export async function portraitFiles(context: Context): Promise<PortraitFile[]> {
  const folders = await entries(`${context.root}/worlds/${context.worldId}/portraits`)
  const speakers = folders.filter((entry) => entry.isDirectory())
  const found = await Promise.all(
    speakers.map(async ({ name: speaker }) => {
      const files = await entries(`${context.root}/worlds/${context.worldId}/portraits/${speaker}`)
      return files
        .filter((file) => file.isFile() && !isRaw(file.name) && extensionOf(file.name) === 'png')
        .map((file) => ({ speaker, fileName: file.name }))
    }),
  )
  return found.flat()
}

export async function portraitProblems(context: Context, facts: ScriptFacts | undefined): Promise<Problem[]> {
  const dir = `worlds/${context.worldId}/portraits`
  const files = await portraitFiles(context)

  // Without the Scripts' facts (they didn't parse) the Speakers are unknown, so only the file names can be judged.
  const undeclared = [...new Set(files.map((file) => file.speaker))]
    .filter((speaker) => facts !== undefined && !facts.speakers.includes(speaker))
    .map((speaker) => errorAt(`${dir}/${speaker}`, `holds Portraits for "${speaker}", but no Script declares a Speaker or Mover of that name`))
  const misnamed = files
    .filter((file) => !EXPRESSIONS.has(stemOf(file.fileName)))
    .map((file) => errorAt(`${dir}/${file.speaker}/${file.fileName}`, `is not a Portrait: "${stemOf(file.fileName)}" is not one of ${[...EXPRESSIONS].join(', ')}`))

  const present = new Set(files.map((file) => `${file.speaker}/${stemOf(file.fileName)}`))
  const missing = (facts?.portraits ?? [])
    .filter(({ speaker, expression }) => !present.has(`${speaker}/${expression.toLowerCase()}`))
    .map(({ speaker, expression, path, line }) =>
      errorAt(path, `uses ${speaker}(${expression}), but ${dir}/${speaker}/${expression.toLowerCase()}.png does not exist`, line),
    )
  return [...undeclared, ...misnamed, ...missing]
}
