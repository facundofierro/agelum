'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  KanbanBoard, 
  type KanbanCardType, 
  type KanbanColumnType,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Button
} from '@agelum/kanban'

interface Epic {
  id: string
  title: string
  description: string
  state: 'backlog' | 'priority' | 'pending' | 'doing' | 'done'
  createdAt: string
  path: string
}

const columns: KanbanColumnType[] = [
  { id: 'backlog', title: 'Backlog', color: 'gray', order: 0 },
  { id: 'priority', title: 'Priority', color: 'red', order: 1 },
  { id: 'pending', title: 'Pending', color: 'yellow', order: 2 },
  { id: 'doing', title: 'Doing', color: 'blue', order: 3 },
  { id: 'done', title: 'Done', color: 'green', order: 4 },
]

interface EpicsKanbanProps {
  repo: string
  onEpicSelect: (epic: Epic) => void
}

export default function EpicsKanban({ repo, onEpicSelect }: EpicsKanbanProps) {
  const [epics, setEpics] = useState<Epic[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEpicColumn, setNewEpicColumn] = useState('')
  const [newEpicTitle, setNewEpicTitle] = useState('')
  const [newEpicDescription, setNewEpicDescription] = useState('')

  const fetchEpics = useCallback(async () => {
    const res = await fetch(`/api/epics?repo=${encodeURIComponent(repo)}`)
    const data = await res.json()
    setEpics(data.epics || [])
  }, [repo])

  useEffect(() => {
    fetchEpics()
  }, [fetchEpics, refreshKey])

  const cards = epics.map<KanbanCardType>((epic, index) => ({
    id: epic.id,
    title: epic.title,
    description: epic.description,
    columnId: epic.state,
    order: index,
  }))

  const handleAddCard = useCallback(
    async (columnId: string) => {
      setNewEpicColumn(columnId)
      setNewEpicTitle('')
      setNewEpicDescription('')
      setIsAddDialogOpen(true)
    },
    []
  )

  const handleCreateEpic = useCallback(
    async () => {
      if (!newEpicTitle.trim()) return

      const res = await fetch('/api/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          action: 'create',
          data: { 
            title: newEpicTitle.trim(), 
            description: newEpicDescription.trim(), 
            state: newEpicColumn 
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create epic')

      setRefreshKey((k) => k + 1)
      setIsAddDialogOpen(false)
      setNewEpicTitle('')
      setNewEpicDescription('')
    },
    [repo, newEpicTitle, newEpicDescription, newEpicColumn]
  )

  const handleCardMove = useCallback(
    async (cardId: string, fromState: string, toState: string) => {
      setEpics((prev) =>
        prev.map((e) => (e.id === cardId ? { ...e, state: toState as Epic['state'] } : e))
      )

      const res = await fetch('/api/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          action: 'move',
          epicId: cardId,
          fromState,
          toState,
        }),
      })

      if (!res.ok) {
        setRefreshKey((k) => k + 1)
        const data = await res.json()
        throw new Error(data.error || 'Failed to move epic')
      }

      setRefreshKey((k) => k + 1)
    },
    [repo]
  )

  return (
    <>
      <div className="h-full">
        <KanbanBoard
          columns={columns}
          cards={cards}
          onAddCard={handleAddCard}
          onCardMove={handleCardMove}
          onCardClick={(card: KanbanCardType) => {
            const epic = epics.find((e) => e.id === card.id)
            if (epic) onEpicSelect(epic)
          }}
          onCardEdit={(card: KanbanCardType) => {
            const epic = epics.find((e) => e.id === card.id)
            if (epic) onEpicSelect(epic)
          }}
          key={refreshKey}
        />
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Epic</DialogTitle>
            <DialogDescription>
              Add a new epic to {columns.find(c => c.id === newEpicColumn)?.title || 'the board'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="epic-title">Title</Label>
              <Input
                id="epic-title"
                placeholder="Epic title"
                value={newEpicTitle}
                onChange={(e) => setNewEpicTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleCreateEpic()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="epic-description">Description</Label>
              <Textarea
                id="epic-description"
                placeholder="Epic description (optional)"
                value={newEpicDescription}
                onChange={(e) => setNewEpicDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEpic}
              disabled={!newEpicTitle.trim()}
            >
              Create Epic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
