import { readFile, readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'

// Sorted, so a report never depends on directory order. A missing folder has no entries.
export async function entries(dir: string): Promise<Dirent[]> {
  try {
    const found = await readdir(dir, { withFileTypes: true })
    return found.toSorted((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isFile()
  } catch {
    return false
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

// Every file under `dir`, relative to it with `/` separators.
export async function filesUnder(dir: string, prefix = ''): Promise<string[]> {
  const children = await entries(dir)
  const found = await Promise.all(
    children.map((entry) => {
      const relative = `${prefix}${entry.name}`
      if (entry.isDirectory()) {
        return filesUnder(`${dir}/${entry.name}`, `${relative}/`)
      }
      return entry.isFile() ? [relative] : []
    }),
  )
  return found.flat()
}

// The JSON object in `path`, or why there is none: the file is missing, isn't JSON, or holds something other than an object.
export async function readJsonObject<T extends object>(path: string): Promise<{ value: T } | { reason: string }> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { value: value as T } : { reason: 'is not a JSON object' }
  } catch (error) {
    return { reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'does not exist' : `is not valid JSON: ${(error as Error).message}` }
  }
}

// `raw.*` is the Author's source art, and is never Published (adr/0035).
export function isRaw(fileName: string): boolean {
  return fileName.split('.')[0] === 'raw'
}

export function extensionOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
}

export function stemOf(fileName: string): string {
  return fileName.slice(0, fileName.lastIndexOf('.'))
}
