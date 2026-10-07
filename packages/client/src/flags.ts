export type Flags = Record<string, boolean | number | string>

// One Student's Flags; a session reads and writes only through this.
export interface FlagStore {
  getFlags: () => Promise<Flags>
  setFlags: (patch: Flags) => Promise<void>
}

// In memory, so a reload starts again from `initial`.
export function createFlagStore(initial: Readonly<Flags> = {}): FlagStore {
  const flags: Flags = { ...initial }

  return {
    async getFlags(): Promise<Flags> {
      return { ...flags }
    },
    async setFlags(patch: Flags): Promise<void> {
      Object.assign(flags, patch)
    },
  }
}
