export interface Problem {
  severity: 'error' | 'warning'

  // Relative to the content root, with `/` separators.
  file: string
  line?: number
  message: string
}

// Where a World lives: its folder is `worlds/<worldId>` under the content root.
export interface Context {
  root: string
  worldId: string
}

export function errorAt(file: string, message: string, line?: number): Problem {
  return { severity: 'error', file, line, message }
}

export function warningAt(file: string, message: string, line?: number): Problem {
  return { severity: 'warning', file, line, message }
}

export function formatProblem({ severity, file, line, message }: Problem): string {
  return `${severity}: ${file}${line === undefined ? '' : `:${line}`}: ${message}`
}
