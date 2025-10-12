import ARViewer from '@/components/vr'
import { createFileRoute } from '@tanstack/react-router'

import {
  Zap,
  Server,
  Route as RouteIcon,
  Shield,
  Waves,
  Sparkles,
} from 'lucide-react'
// import modelUrl from "@/assets/models/test.glb"

export const Route = createFileRoute('/')({
  component: App,

})

function App() {
  return <ARViewer modelUrl={'/models/test.glb'} />
}
