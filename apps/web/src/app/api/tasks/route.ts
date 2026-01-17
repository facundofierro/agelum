import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Task {
  id: string
  title: string
  description: string
  state: 'backlog' | 'priority' | 'pending' | 'doing' | 'done'
  createdAt: string
  epic?: string
  assignee?: string
  path: string
}

function ensureAgelumStructure(agelumDir: string) {
  const directories = [
    'plan',
    'ideas',
    'docs',
    'context',
    'actions',
    'skills',
    path.join('epics', 'backlog'),
    path.join('epics', 'priority'),
    path.join('epics', 'pending'),
    path.join('epics', 'doing'),
    path.join('epics', 'done'),
    path.join('tasks', 'backlog'),
    path.join('tasks', 'priority'),
    path.join('tasks', 'pending'),
    path.join('tasks', 'doing'),
    path.join('tasks', 'done')
  ]

  fs.mkdirSync(agelumDir, { recursive: true })
  for (const dir of directories) {
    fs.mkdirSync(path.join(agelumDir, dir), { recursive: true })
  }
}

function fileNameToId(fileName: string): string {
  return fileName.replace('.md', '')
}

function parseTaskFile(filePath: string, state: 'backlog' | 'priority' | 'pending' | 'doing' | 'done', epic?: string): Task | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fileName = path.basename(filePath)
    const stats = fs.statSync(filePath)

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let title = fileNameToId(fileName)
    let description = ''
    let assignee = ''

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const titleMatch = frontmatter.match(/title:\s*(.+)/)
      description = frontmatter.match(/description:\s*(.+)/)?.[1] || ''
      assignee = frontmatter.match(/assignee:\s*(.+)/)?.[1]?.trim() || ''
      if (titleMatch) {
        title = titleMatch[1].trim()
      }
    }

    return {
      id: fileNameToId(fileName),
      title,
      description,
      state,
      createdAt: stats.mtime.toISOString(),
      ...(epic && { epic }),
      assignee,
      path: filePath
    }
  } catch {
    return null
  }
}

function readTasksRecursively(dir: string, state: 'backlog' | 'priority' | 'pending' | 'doing' | 'done'): Task[] {
  const tasks: Task[] = []
  
  if (!fs.existsSync(dir)) return tasks

  const items = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    
    if (item.isDirectory()) {
      // This is an epic folder, read tasks from it
      const epicName = item.name
      const epicTasks = readTasksRecursively(fullPath, state)
      // Add epic name to each task
      tasks.push(...epicTasks.map(task => ({ ...task, epic: epicName })))
    } else if (item.isFile() && item.name.endsWith('.md')) {
      // This is a task file at the root level (no epic)
      const task = parseTaskFile(fullPath, state)
      if (task) tasks.push(task)
    }
  }
  
  return tasks
}

function readTasks(repo: string): Task[] {
  const homeDir = (process.env.HOME || process.env.USERPROFILE || process.cwd())
  const gitDir = path.join(homeDir, 'git')
  const agelumDir = path.join(gitDir, repo, 'agelum')
  ensureAgelumStructure(agelumDir)
  const tasksDir = path.join(agelumDir, 'tasks')

  const tasks: Task[] = []
  const states = ['backlog', 'priority', 'pending', 'doing', 'done'] as const

  for (const state of states) {
    const stateDir = path.join(tasksDir, state)
    const stateTasks = readTasksRecursively(stateDir, state)
    tasks.push(...stateTasks)
  }

  return tasks
}

function createTask(repo: string, data: { title: string; description?: string; state?: string; assignee?: string }): Task {
  const homeDir = (process.env.HOME || process.env.USERPROFILE || process.cwd())
  const gitDir = path.join(homeDir, 'git')
  const agelumDir = path.join(gitDir, repo, 'agelum')
  ensureAgelumStructure(agelumDir)
  const tasksDir = path.join(agelumDir, 'tasks')
  const state = (data.state as 'backlog' | 'priority' | 'pending' | 'doing' | 'done') || 'pending'

  const id = `task-${Date.now()}`
  const stateDir = path.join(tasksDir, state)
  fs.mkdirSync(stateDir, { recursive: true })

  const filePath = path.join(stateDir, `${id}.md`)
  const createdAt = new Date().toISOString()

  const frontmatterLines = [
    '---',
    `title: ${data.title}`,
    `created: ${createdAt}`,
    `state: ${state}`,
    ...(data.assignee ? [`assignee: ${data.assignee}`] : []),
    '---'
  ]
  const frontmatter = `${frontmatterLines.join('\n')}\n`

  fs.writeFileSync(filePath, `${frontmatter}\n# ${data.title}\n\n${data.description || ''}\n`)

  return {
    id,
    title: data.title,
    description: data.description || '',
    state,
    createdAt,
    assignee: '',
    path: filePath
  }
}

function findTaskFile(baseDir: string, taskId: string): string | null {
  if (!fs.existsSync(baseDir)) return null
  
  const items = fs.readdirSync(baseDir, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(baseDir, item.name)
    
    if (item.isDirectory()) {
      // Search recursively in subdirectories (epic folders)
      const found = findTaskFile(fullPath, taskId)
      if (found) return found
    } else if (item.isFile() && item.name === `${taskId}.md`) {
      return fullPath
    }
  }
  
  return null
}

function moveTask(repo: string, taskId: string, fromState: string, toState: string): void {
  const homeDir = (process.env.HOME || process.env.USERPROFILE || process.cwd())
  const gitDir = path.join(homeDir, 'git')
  const agelumDir = path.join(gitDir, repo, 'agelum')
  ensureAgelumStructure(agelumDir)
  const tasksDir = path.join(agelumDir, 'tasks')

  const fromStateDir = path.join(tasksDir, fromState)
  const fromPath = findTaskFile(fromStateDir, taskId)
  
  if (!fromPath) {
    throw new Error(`Task file not found: ${taskId}`)
  }

  // Determine if task is in an epic folder
  const relativePath = path.relative(fromStateDir, fromPath)
  const pathParts = relativePath.split(path.sep)
  
  let toPath: string
  if (pathParts.length > 1) {
    // Task is in an epic folder, maintain the epic folder structure
    const epicFolder = pathParts[0]
    const toStateDir = path.join(tasksDir, toState)
    const toEpicDir = path.join(toStateDir, epicFolder)
    fs.mkdirSync(toEpicDir, { recursive: true })
    toPath = path.join(toEpicDir, `${taskId}.md`)
  } else {
    // Task is at root level
    const toStateDir = path.join(tasksDir, toState)
    fs.mkdirSync(toStateDir, { recursive: true })
    toPath = path.join(toStateDir, `${taskId}.md`)
  }

  fs.renameSync(fromPath, toPath)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')

  if (!repo) {
    return NextResponse.json({ tasks: [] })
  }

  const tasks = readTasks(repo)
  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { repo, action, taskId, fromState, toState, data } = body

    if (!repo) {
      return NextResponse.json({ error: 'Repository is required' }, { status: 400 })
    }

    if (action === 'create') {
      const task = createTask(repo, data || {})
      return NextResponse.json({ task })
    }

    if (action === 'move' && taskId && fromState && toState) {
      moveTask(repo, taskId, fromState, toState)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Task API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to process task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
