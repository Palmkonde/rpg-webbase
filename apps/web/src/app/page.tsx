import { Game } from '@/game/game'
import { requireEnv } from '@/env'

// Stands in for the signed-in Student, so switching it shows another Student's Flags.
const DEFAULT_STUDENT = 'dev-student'

function readStudentId(student: string | string[] | undefined): string {
  return typeof student === 'string' && student !== '' ? student : DEFAULT_STUDENT
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.ReactElement> {
  const { student } = await searchParams
  const studentId = readStudentId(student)

  // Keyed by the Student, so switching `?student=` remounts the game instead of carrying one Student's Flags into another's.
  return <Game key={studentId} serviceUrl={requireEnv('GAME_SERVICE_URL')} studentId={studentId} worldId={requireEnv('WORLD_ID')} />
}
