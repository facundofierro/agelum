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
  Textarea,
  Button
} from '@agelum/kanban'

interface Task {
  id: string
  title: string
  description: string
  state: 'pending' | 'doing' | 'done'
  createdAt: string
  epic?: string
  assignee?: string
  path?: string
}

const columns: KanbanColumnType[] = [
  { id: 'pending', title: 'Pending', color: 'yellow', order: 0 },
  { id: 'doing', title: 'Doing', color: 'blue', order: 1 },
  { id: 'done', title: 'Done', color: 'green', order: 2 },
]

interface TaskKanbanProps {
  repo: string
  onTaskSelect: (task: Task) => void
}

export default function TaskKanban({ repo, onTaskSelect }: TaskKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [users, setUsers] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
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

  useEffect(() => {
    if (!repo) return
    fetch(`/api/users?repo=${encodeURIComponent(repo)}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data.users) ? data.users : [])
      })
      .catch(() => {
        setUsers([])
      })
  }, [repo])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter === 'all') return true
      if (assigneeFilter === 'unassigned') return !task.assignee
      return task.assignee === assigneeFilter
    })
  }, [tasks, assigneeFilter])

  const cards = useMemo<KanbanCardType[]>(() => {
    return filteredTasks.map((task, index) => ({
      id: task.id,
      title: task.title,
      description: [task.description, task.epic ? `Epic: ${task.epic}` : null, task.assignee ? `Assignee: ${task.assignee}` : null]
        .filter(Boolean)
        .join('\n'),
      columnId: task.state,
      order: index,
    }))
  }, [filteredTasks])

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
    <div className="h-full">
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border">
        <label className="text-sm text-muted-foreground" htmlFor="assignee-filter">
          Assignee
        </label>
        <select
          id="assignee-filter"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="bg-background text-foreground text-sm rounded-md border border-border px-2 py-1"
        >
          <option value="all">All</option>
          <option value="unassigned">Unassigned</option>
          {users.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </div>
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
  )
}
