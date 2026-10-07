export type Flags = Record<string, boolean | string>

// One Student's Flags; a session reads and writes only through this.
export interface FlagStore {
  getFlags: () => Promise<Flags>
  setFlags: (patch: Flags) => Promise<void>
}
