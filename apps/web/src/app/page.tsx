import { DynamicGameCanvas } from '@/game/dynamic-game-canvas'
import worldConfig from '@/fixtures/world-config.json'

export default function Home(): React.ReactElement {
  return <DynamicGameCanvas worldConfig={worldConfig} />
}
