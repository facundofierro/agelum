'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Textarea
} from '@agelum/kanban'
import { Button } from '@agelum/shadcn'

interface Task {
  id: string
  title: string
  description: string
  state: 'backlog' | 'priority' | 'pending' | 'doing' | 'done'
  createdAt: string
  epic?: string
  assignee?: string
  path?: string
}

const columns: KanbanColumnType[] = [
  { id: 'backlog', title: 'Backlog', color: 'gray', order: 0 },
  { id: 'priority', title: 'Priority', color: 'red', order: 1 },
  { id: 'pending', title: 'Pending', color: 'yellow', order: 2 },
  { id: 'doing', title: 'Doing', color: 'blue', order: 3 },
  { id: 'done', title: 'Done', color: 'green', order: 4 },
]

interface TaskKanbanProps {
  repo: string
  onTaskSelect: (task: Task) => void
}

export default function TaskKanban({ repo, onTaskSelect }: TaskKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?repo=${encodeURIComponent(repo)}`)
    const data = await res.json()
    setTasks(data.tasks || [])
  }, [repo])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks, refreshKey])

  const cards = useMemo<KanbanCardType[]>(() => {
    return tasks.map((task, index) => ({
      id: task.id,
      title: task.title,
      description: [task.description, task.epic ? `Epic: ${task.epic}` : null, task.assignee ? `Assignee: ${task.assignee}` : null]
        .filter(Boolean)
        .join('\n'),
      columnId: task.state,
      order: index,
    }))
  }, [tasks])

  const handleAddCard = useCallback(
    async (columnId: string) => {
      setNewTaskColumn(columnId)
      setNewTaskTitle('')
      setNewTaskDescription('')
      setIsAddDialogOpen(true)
    },
    []
  )

  const handleCreateTask = useCallback(
    async () => {
      if (!newTaskTitle.trim()) return

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          action: 'create',
          data: { 
            title: newTaskTitle.trim(), 
            description: newTaskDescription.trim(), 
            state: newTaskColumn 
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create task')

      setRefreshKey((k) => k + 1)
      setIsAddDialogOpen(false)
      setNewTaskTitle('')
      setNewTaskDescription('')
    },
    [repo, newTaskTitle, newTaskDescription, newTaskColumn]
  )

  const handleCardMove = useCallback(
    async (cardId: string, fromState: string, toState: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === cardId ? { ...t, state: toState as Task['state'] } : t))
      )

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          action: 'move',
          taskId: cardId,
          fromState,
          toState,
        }),
      })

      if (!res.ok) {
        setRefreshKey((k) => k + 1)
        const data = await res.json()
        throw new Error(data.error || 'Failed to move task')
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
            const task = tasks.find((t) => t.id === card.id)
            if (task) onTaskSelect(task)
          }}
          onCardEdit={(card: KanbanCardType) => {
            const task = tasks.find((t) => t.id === card.id)
            if (task) onTaskSelect(task)
          }}
          key={refreshKey}
        />
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to {columns.find(c => c.id === newTaskColumn)?.title || 'the board'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleCreateTask()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task description (optional)"
                value={newTaskDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTaskDescription(e.target.value)}
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
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim()}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
