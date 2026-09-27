import seed from '../fixtures/student-state.json' with { type: 'json' }

export type Flags = Record<string, boolean | number | string>

interface StudentSeed {
  studentId: string
  flags: Flags
}

export interface FlagStore {
  getFlags: (studentId: string) => Promise<Flags>
  setFlags: (studentId: string, patch: Flags) => Promise<void>
}

export function createFlagStore(seedData: StudentSeed = seed): FlagStore {
  const store = new Map<string, Flags>()

  function seedIfNeeded(studentId: string): Flags {
    if (!store.has(studentId)) {
      const initial = studentId === seedData.studentId ? seedData.flags : {}
      store.set(studentId, { ...initial })
    }
    return store.get(studentId)!
  }

  return {
    async getFlags(studentId: string): Promise<Flags> {
      return { ...seedIfNeeded(studentId) }
    },
    async setFlags(studentId: string, patch: Flags): Promise<void> {
      Object.assign(seedIfNeeded(studentId), patch)
    },
  }
}

// The Host's single shared store, seeded from the local fixture.
export const flagStore = createFlagStore()

export const currentStudentId: string = seed.studentId

// Shared "don't replay" gate for CG/Cutscene, per spec's "CG & Cutscene" section.
export async function runOnce(
  scope: { store: FlagStore; studentId: string },
  id: string,
  playFn: () => Promise<void> | void,
): Promise<void> {
  const seenKey = `${id}_seen`
  const flags = await scope.store.getFlags(scope.studentId)

  if (flags[seenKey]) {return}

  await playFn()
  await scope.store.setFlags(scope.studentId, { [seenKey]: true })
}
