'use client'

import { KanbanBoard, type KanbanCardType, type KanbanColumnType } from '@agelum/kanban'

const columns: KanbanColumnType[] = [
  { id: 'todo', title: 'To Do', color: 'yellow', order: 0 },
  { id: 'doing', title: 'Doing', color: 'blue', order: 1 },
  { id: 'done', title: 'Done', color: 'green', order: 2 },
]

const cards: KanbanCardType[] = [
  { id: '1', title: 'Test Task 1', columnId: 'todo', order: 0 },
  { id: '2', title: 'Test Task 2', columnId: 'doing', order: 1 },
  { id: '3', title: 'Test Task 3', columnId: 'done', order: 2 },
]

export default function TestKanban() {
  return (
    <div className="h-full">
      <KanbanBoard columns={columns} cards={cards} />
    </div>
  )
}
