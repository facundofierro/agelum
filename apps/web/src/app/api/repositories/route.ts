import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { ensureRootGitDirectory } from '@/lib/config'

// Server mode: when deployed (e.g., Vercel), will use database instead of filesystem
const SERVER_MODE = process.env.SERVER_MODE === 'true'

export async function GET() {
  try {
    if (SERVER_MODE) {
      // TODO: Implement database query for repositories
      return NextResponse.json({ 
        repositories: [], 
        basePath: 'server-mode',
        serverMode: true 
      })
    }

    // Local mode: use filesystem with global config
    const basePath = ensureRootGitDirectory()

    let repositories: string[] = []

    if (fs.existsSync(basePath)) {
      const entries = fs.readdirSync(basePath, { withFileTypes: true })
      repositories = entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name)
    }

    return NextResponse.json({ repositories, basePath, serverMode: false })
  } catch (error) {
    return NextResponse.json({ 
      repositories: [], 
      basePath: '', 
      serverMode: SERVER_MODE,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
