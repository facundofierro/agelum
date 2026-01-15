import fs from 'node:fs';
import path from 'node:path';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// --- Types & Constants ---

type TaskState = 'pending' | 'doing' | 'done';
type DocumentType =
  | 'task'
  | 'epic'
  | 'plan'
  | 'doc'
  | 'command'
  | 'skill'
  | 'agent'
  | 'context';

const AGELUM_STRUCTURE = [
  'docs',
  'plans',
  'tasks/pending',
  'tasks/doing',
  'tasks/done',
  'commands',
  'skills',
  'agents',
  'context',
  'epics',
];

const nonTaskTypeToDir: Record<Exclude<DocumentType, 'task'>, string> = {
  epic: 'epics',
  plan: 'plans',
  doc: 'docs',
  command: 'commands',
  skill: 'skills',
  agent: 'agents',
  context: 'context',
};

// --- Helpers ---

function getAgelumPath(repoPath: string): string {
  return path.join(repoPath, 'agelum');
}

function ensureAgelumStructure(repoPath: string): string {
  const agelumPath = getAgelumPath(repoPath);

  fs.mkdirSync(agelumPath, { recursive: true });
  AGELUM_STRUCTURE.forEach((dir) => {
    fs.mkdirSync(path.join(agelumPath, dir), { recursive: true });
  });

  return agelumPath;
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[\/\\]/g, '-')
    .replace(/[\0<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureMdExtension(fileName: string): string {
  const trimmed = fileName.trim();
  if (trimmed.toLowerCase().endsWith('.md')) return trimmed;
  return `${trimmed}.md`;
}

function formatStoryPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatPriority(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('priority must be a non-negative number');
  }
  return String(Math.trunc(value)).padStart(2, '0');
}

function buildFileName(args: {
  type: DocumentType;
  title: string;
  priority?: number;
  storyPoints?: number;
}): string {
  const title = sanitizeFileNamePart(args.title);
  if (!title) throw new Error('title is required');

  if (args.type === 'task') {
    if (args.priority === undefined)
      throw new Error('priority is required for task');
    if (args.storyPoints === undefined)
      throw new Error('storyPoints is required for task');
    const priority = formatPriority(args.priority);
    const storyPoints = formatStoryPoints(args.storyPoints);
    return `${priority} ${title} (${storyPoints}).md`;
  }

  if (args.storyPoints !== undefined) {
    const storyPoints = formatStoryPoints(args.storyPoints);
    return `${title} (${storyPoints}).md`;
  }

  return `${title}.md`;
}

function buildFrontmatter(args: {
  type: DocumentType;
  title: string;
  state?: TaskState;
  priority?: number;
  storyPoints?: number;
}): string {
  const lines: string[] = [
    '---',
    `title: ${args.title}`,
    `created: ${new Date().toISOString()}`,
    `type: ${args.type}`,
  ];

  if (args.type === 'task') {
    if (!args.state) throw new Error('state is required for task');
    lines.push(`state: ${args.state}`);
    if (args.priority !== undefined)
      lines.push(`priority: ${formatPriority(args.priority)}`);
    if (args.storyPoints !== undefined)
      lines.push(`storyPoints: ${formatStoryPoints(args.storyPoints)}`);
  } else {
    if (args.storyPoints !== undefined)
      lines.push(`storyPoints: ${formatStoryPoints(args.storyPoints)}`);
  }

  lines.push('---');
  return `${lines.join('\n')}\n`;
}

// --- Tools Definition ---

const tools: Record<string, Tool> = {
  create: {
    name: 'create',
    description:
      'Create a new markdown file in the agelum structure. Returns the file path only.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'task',
            'epic',
            'plan',
            'doc',
            'command',
            'skill',
            'agent',
            'context',
          ],
          description: 'Document type',
        },
        title: {
          type: 'string',
          description: 'Title used for naming and frontmatter',
        },
        content: { type: 'string', description: 'Markdown content body' },
        state: {
          type: 'string',
          enum: ['pending', 'doing', 'done'],
          default: 'pending',
          description: 'Task state (only for type=task)',
        },
        priority: {
          type: 'number',
          description: 'Task priority number (only for type=task)',
        },
        storyPoints: {
          type: 'number',
          description: 'Story points (type=task required, type=epic optional)',
        },
        fileName: {
          type: 'string',
          description: 'Override file name (optional, with or without .md)',
        },
      },
      required: ['type', 'title'],
    },
  },
  move: {
    name: 'move',
    description: 'Move a task between states. Returns from/to paths only.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['task'],
          description: 'Only task is supported',
        },
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'number', description: 'Task priority number' },
        storyPoints: { type: 'number', description: 'Task story points' },
        fileName: {
          type: 'string',
          description: 'Override file name (optional)',
        },
        fromState: {
          type: 'string',
          enum: ['pending', 'doing', 'done'],
          description: 'Current state',
        },
        toState: {
          type: 'string',
          enum: ['pending', 'doing', 'done'],
          description: 'Target state',
        },
      },
      required: ['type', 'fromState', 'toState'],
    },
  },
  get: {
    name: 'get',
    description:
      'Resolve a file path in the agelum structure. Returns the file path only.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'task',
            'epic',
            'plan',
            'doc',
            'command',
            'skill',
            'agent',
            'context',
          ],
          description: 'Document type',
        },
        title: {
          type: 'string',
          description:
            'Title used to build the file name (if fileName omitted)',
        },
        state: {
          type: 'string',
          enum: ['pending', 'doing', 'done'],
          description: 'Task state (optional)',
        },
        priority: {
          type: 'number',
          description: 'Task priority number (only for type=task)',
        },
        storyPoints: {
          type: 'number',
          description: 'Story points (type=task required, type=epic optional)',
        },
        fileName: {
          type: 'string',
          description: 'Override file name (optional)',
        },
      },
      required: ['type'],
    },
  },
};

// --- Repo Discovery Logic ---

/**
 * Finds the repository root.
 * Prioritizes `process.cwd()` (Stdio mode).
 * If not found, falls back to `globalConfigRoot` (Service mode).
 */
export function findRepoRootPath(globalConfigRoot?: string): string | null {
  // 1. Try finding .git from current working directory (Stdio mode)
  console.error(`Agelum: Searching for .git starting from ${process.cwd()}`);
  let currentPath = process.cwd();
  
  // Safety check: Don't walk up if we are in a system root or unexpected place
  // But for now, standard walking is fine.
  
  // We limit the walk to avoid infinite loops or going too far up in Docker
  const MAX_DEPTH = 10;
  let depth = 0;

  while (depth < MAX_DEPTH) {
    const gitPath = path.join(currentPath, '.git');
    if (fs.existsSync(gitPath)) {
      console.error(`Agelum: Found .git at ${currentPath}`);
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) break;
    currentPath = parentPath;
    depth++;
  }
  
  console.error('Agelum: Could not find .git via CWD traversal.');

  // 2. Fallback to Global Config (Service mode / Web App context)
  if (globalConfigRoot) {
    console.error(`Agelum: Falling back to global config root: ${globalConfigRoot}`);
    if (fs.existsSync(globalConfigRoot)) {
       // Check if it has .git or is a valid dir
       return globalConfigRoot;
    }
  }

  return null;
}

// --- Server Setup ---

export function createAgelumMcpServer(globalConfigRoot?: string) {
  const server = new Server(
    {
      name: 'agelum',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(tools),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const repoRootPath = findRepoRootPath(globalConfigRoot);
      if (!repoRootPath) throw new Error('Could not find repository root');
      const agelumPath = ensureAgelumStructure(repoRootPath);

      switch (name) {
        case 'create': {
          const {
            type,
            title,
            content = '',
            state = 'pending',
            priority,
            storyPoints,
            fileName,
          } = args as {
            type: DocumentType;
            title: string;
            content?: string;
            state?: TaskState;
            priority?: number;
            storyPoints?: number;
            fileName?: string;
          };

          const resolvedFileName = ensureMdExtension(
            sanitizeFileNamePart(
              fileName ?? buildFileName({ type, title, priority, storyPoints })
            )
          );

          const targetDir =
            type === 'task'
              ? path.join(agelumPath, 'tasks', state)
              : path.join(agelumPath, nonTaskTypeToDir[type]);

          fs.mkdirSync(targetDir, { recursive: true });
          const filePath = path.join(targetDir, resolvedFileName);

          if (fs.existsSync(filePath))
            throw new Error(`File already exists: ${filePath}`);

          const frontmatter = buildFrontmatter({
            type,
            title,
            state,
            priority,
            storyPoints,
          });
          const body = `\n# ${title}\n\n${content}\n`;
          fs.writeFileSync(filePath, `${frontmatter}${body}`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ path: filePath }),
              },
            ],
          };
        }

        case 'move': {
          const {
            type,
            title = '',
            priority,
            storyPoints,
            fileName,
            fromState,
            toState,
          } = args as {
            type: 'task';
            title?: string;
            priority?: number;
            storyPoints?: number;
            fileName?: string;
            fromState: TaskState;
            toState: TaskState;
          };

          if (fromState === toState) {
             throw new Error('fromState and toState must be different');
          }

          let sourceFileName = fileName;
          if (!sourceFileName) {
             if (!title) throw new Error('title is required if fileName is not provided');
             sourceFileName = buildFileName({ type, title, priority, storyPoints });
          }
          sourceFileName = ensureMdExtension(sourceFileName);

          const sourceDir = path.join(agelumPath, 'tasks', fromState);
          const sourcePath = path.join(sourceDir, sourceFileName);

          if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source file not found: ${sourcePath}`);
          }

          const targetDir = path.join(agelumPath, 'tasks', toState);
          fs.mkdirSync(targetDir, { recursive: true });
          const targetPath = path.join(targetDir, sourceFileName);

          if (fs.existsSync(targetPath)) {
             throw new Error(`Target file already exists: ${targetPath}`);
          }

          fs.renameSync(sourcePath, targetPath);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ from: sourcePath, to: targetPath }),
              },
            ],
          };
        }

        case 'get': {
          const {
            type,
            title = '',
            state,
            priority,
            storyPoints,
            fileName,
          } = args as {
            type: DocumentType;
            title?: string;
            state?: TaskState;
            priority?: number;
            storyPoints?: number;
            fileName?: string;
          };

          let resolvedFileName = fileName;
          if (!resolvedFileName) {
             if (!title) throw new Error('title is required if fileName is not provided');
             // For tasks, we might not have priority/storyPoints when getting, so we might need to search?
             // But the user simplified requirements: "get will return the path only".
             // If the user provides partial info, we can't build the exact filename if it relies on priority.
             // Assuming strict inputs for now as per "buildFileName".
             if (type === 'task') {
                 if (priority !== undefined && storyPoints !== undefined) {
                     resolvedFileName = buildFileName({ type, title, priority, storyPoints });
                 } else {
                     // If we lack details, we might want to SEARCH for the file by title?
                     // For now, let's assume exact match or fail if params missing.
                     // But let's allow "fuzzy" get if just title is provided?
                     // The user requirement "get will return the path only" implies resolution.
                 }
             } else {
                 resolvedFileName = buildFileName({ type, title, priority, storyPoints });
             }
          }
          
          if (!resolvedFileName && type === 'task') {
               // Fallback: search for file starting with title? Or containing title?
               // Given strict naming, maybe we search.
               // Let's keep it simple: if we can't build it, we return what we think it is.
               resolvedFileName = ensureMdExtension(sanitizeFileNamePart(title));
          }
          
          if (resolvedFileName) {
              resolvedFileName = ensureMdExtension(resolvedFileName);
          } else {
             throw new Error("Could not resolve filename from arguments");
          }

          let possiblePaths: string[] = [];
          if (type === 'task') {
            if (state) {
              possiblePaths.push(path.join(agelumPath, 'tasks', state, resolvedFileName));
            } else {
              possiblePaths.push(path.join(agelumPath, 'tasks', 'pending', resolvedFileName));
              possiblePaths.push(path.join(agelumPath, 'tasks', 'doing', resolvedFileName));
              possiblePaths.push(path.join(agelumPath, 'tasks', 'done', resolvedFileName));
            }
          } else {
            possiblePaths.push(path.join(agelumPath, nonTaskTypeToDir[type], resolvedFileName));
          }

          const existingPath = possiblePaths.find(p => fs.existsSync(p));
          
          if (existingPath) {
             return {
                content: [{ type: 'text', text: JSON.stringify({ path: existingPath, exists: true }) }]
             };
          }

          // If not found, return the expected path (first option)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ path: possiblePaths[0], exists: false }),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
  
  return server;
}
