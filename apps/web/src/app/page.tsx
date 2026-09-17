import { DynamicGameCanvas } from '@/game/DynamicGameCanvas'
import worldConfig from '@/fixtures/world-config.json'

export default function Home() {
  return <DynamicGameCanvas worldConfig={worldConfig} />
}
