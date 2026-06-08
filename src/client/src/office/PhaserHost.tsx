import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './scenes/OfficeScene'
import type { Project } from '../../../shared/types'

type EventKey = 'task.queued' | 'task.started' | 'task.completed' | 'task.failed' | 'github.push'
interface OfficeEvent { projectId: string; event: EventKey; ts: number }

interface Props {
  projects: Project[]
  lastEvent: OfficeEvent | null
  audioEnabled: boolean
  onDeskClick: (projectId: string) => void
}

export function PhaserHost({ projects, lastEvent, audioEnabled, onDeskClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#0b0f1a',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      scene: [OfficeScene],
      pixelArt: false,
      render: { antialias: true },
    })
    game.registry.set('onDeskClick', onDeskClick)
    game.registry.set('projects', projects)
    game.registry.set('audioEnabled', audioEnabled)
    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
  }, [onDeskClick, projects])

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.registry.set('projects', projects)
    }
  }, [projects])

  useEffect(() => {
    if (gameRef.current && lastEvent) {
      gameRef.current.registry.set('lastEvent', lastEvent)
    }
  }, [lastEvent])

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.registry.set('audioEnabled', audioEnabled)
    }
  }, [audioEnabled])

  return <div ref={containerRef} className="w-full h-full" />
}
