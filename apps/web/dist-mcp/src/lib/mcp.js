"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRepoRootPath = findRepoRootPath;
exports.createAgelumMcpServer = createAgelumMcpServer;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
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
const nonTaskTypeToDir = {
    epic: 'epics',
    plan: 'plans',
    doc: 'docs',
    command: 'commands',
    skill: 'skills',
    agent: 'agents',
    context: 'context',
};
// --- Helpers ---
function getAgelumPath(repoPath) {
    return node_path_1.default.join(repoPath, 'agelum');
}
function ensureAgelumStructure(repoPath) {
    const agelumPath = getAgelumPath(repoPath);
    node_fs_1.default.mkdirSync(agelumPath, { recursive: true });
    AGELUM_STRUCTURE.forEach((dir) => {
        node_fs_1.default.mkdirSync(node_path_1.default.join(agelumPath, dir), { recursive: true });
    });
    return agelumPath;
}
function sanitizeFileNamePart(value) {
    return value
        .replace(/[\/\\]/g, '-')
        .replace(/[\0<>:"|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function ensureMdExtension(fileName) {
    const trimmed = fileName.trim();
    if (trimmed.toLowerCase().endsWith('.md'))
        return trimmed;
    return `${trimmed}.md`;
}
function formatStoryPoints(value) {
    return Number.isInteger(value) ? String(value) : String(value);
}
function formatPriority(value) {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error('priority must be a non-negative number');
    }
    return String(Math.trunc(value)).padStart(2, '0');
}
function buildFileName(args) {
    const title = sanitizeFileNamePart(args.title);
    if (!title)
        throw new Error('title is required');
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
function buildFrontmatter(args) {
    const lines = [
        '---',
        `title: ${args.title}`,
        `created: ${new Date().toISOString()}`,
        `type: ${args.type}`,
    ];
    if (args.type === 'task') {
        if (!args.state)
            throw new Error('state is required for task');
        lines.push(`state: ${args.state}`);
        if (args.priority !== undefined)
            lines.push(`priority: ${formatPriority(args.priority)}`);
        if (args.storyPoints !== undefined)
            lines.push(`storyPoints: ${formatStoryPoints(args.storyPoints)}`);
    }
    else {
        if (args.storyPoints !== undefined)
            lines.push(`storyPoints: ${formatStoryPoints(args.storyPoints)}`);
    }
    lines.push('---');
    return `${lines.join('\n')}\n`;
}
// --- Tools Definition ---
const tools = {
    create: {
        name: 'create',
        description: 'Create a new markdown file in the agelum structure. Returns the file path only.',
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
        description: 'Resolve a file path in the agelum structure. Returns the file path only.',
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
                    description: 'Title used to build the file name (if fileName omitted)',
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
function findRepoRootPath(globalConfigRoot) {
    // 1. Try finding .git from current working directory (Stdio mode)
    console.error(`Agelum: Searching for .git starting from ${process.cwd()}`);
    let currentPath = process.cwd();
    // Safety check: Don't walk up if we are in a system root or unexpected place
    // But for now, standard walking is fine.
    // We limit the walk to avoid infinite loops or going too far up in Docker
    const MAX_DEPTH = 10;
    let depth = 0;
    while (depth < MAX_DEPTH) {
        const gitPath = node_path_1.default.join(currentPath, '.git');
        if (node_fs_1.default.existsSync(gitPath)) {
            console.error(`Agelum: Found .git at ${currentPath}`);
            return currentPath;
        }
        const parentPath = node_path_1.default.dirname(currentPath);
        if (parentPath === currentPath)
            break;
        currentPath = parentPath;
        depth++;
    }
    console.error('Agelum: Could not find .git via CWD traversal.');
    // 2. Fallback to Global Config (Service mode / Web App context)
    if (globalConfigRoot) {
        console.error(`Agelum: Falling back to global config root: ${globalConfigRoot}`);
        if (node_fs_1.default.existsSync(globalConfigRoot)) {
            // Check if it has .git or is a valid dir
            return globalConfigRoot;
        }
    }
    return null;
}
// --- Server Setup ---
function createAgelumMcpServer(globalConfigRoot) {
    const server = new index_js_1.Server({
        name: 'agelum',
        version: '0.1.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
        return {
            tools: Object.values(tools),
        };
    });
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const repoRootPath = findRepoRootPath(globalConfigRoot);
            if (!repoRootPath)
                throw new Error('Could not find repository root');
            const agelumPath = ensureAgelumStructure(repoRootPath);
            switch (name) {
                case 'create': {
                    const { type, title, content = '', state = 'pending', priority, storyPoints, fileName, } = args;
                    const resolvedFileName = ensureMdExtension(sanitizeFileNamePart(fileName ?? buildFileName({ type, title, priority, storyPoints })));
                    const targetDir = type === 'task'
                        ? node_path_1.default.join(agelumPath, 'tasks', state)
                        : node_path_1.default.join(agelumPath, nonTaskTypeToDir[type]);
                    node_fs_1.default.mkdirSync(targetDir, { recursive: true });
                    const filePath = node_path_1.default.join(targetDir, resolvedFileName);
                    if (node_fs_1.default.existsSync(filePath))
                        throw new Error(`File already exists: ${filePath}`);
                    const frontmatter = buildFrontmatter({
                        type,
                        title,
                        state,
                        priority,
                        storyPoints,
                    });
                    const body = `\n# ${title}\n\n${content}\n`;
                    node_fs_1.default.writeFileSync(filePath, `${frontmatter}${body}`);
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
                    const { type, title = '', priority, storyPoints, fileName, fromState, toState, } = args;
                    if (fromState === toState) {
                        throw new Error('fromState and toState must be different');
                    }
                    let sourceFileName = fileName;
                    if (!sourceFileName) {
                        if (!title)
                            throw new Error('title is required if fileName is not provided');
                        sourceFileName = buildFileName({ type, title, priority, storyPoints });
                    }
                    sourceFileName = ensureMdExtension(sourceFileName);
                    const sourceDir = node_path_1.default.join(agelumPath, 'tasks', fromState);
                    const sourcePath = node_path_1.default.join(sourceDir, sourceFileName);
                    if (!node_fs_1.default.existsSync(sourcePath)) {
                        throw new Error(`Source file not found: ${sourcePath}`);
                    }
                    const targetDir = node_path_1.default.join(agelumPath, 'tasks', toState);
                    node_fs_1.default.mkdirSync(targetDir, { recursive: true });
                    const targetPath = node_path_1.default.join(targetDir, sourceFileName);
                    if (node_fs_1.default.existsSync(targetPath)) {
                        throw new Error(`Target file already exists: ${targetPath}`);
                    }
                    node_fs_1.default.renameSync(sourcePath, targetPath);
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
                    const { type, title = '', state, priority, storyPoints, fileName, } = args;
                    let resolvedFileName = fileName;
                    if (!resolvedFileName) {
                        if (!title)
                            throw new Error('title is required if fileName is not provided');
                        // For tasks, we might not have priority/storyPoints when getting, so we might need to search?
                        // But the user simplified requirements: "get will return the path only".
                        // If the user provides partial info, we can't build the exact filename if it relies on priority.
                        // Assuming strict inputs for now as per "buildFileName".
                        if (type === 'task') {
                            if (priority !== undefined && storyPoints !== undefined) {
                                resolvedFileName = buildFileName({ type, title, priority, storyPoints });
                            }
                            else {
                                // If we lack details, we might want to SEARCH for the file by title?
                                // For now, let's assume exact match or fail if params missing.
                                // But let's allow "fuzzy" get if just title is provided?
                                // The user requirement "get will return the path only" implies resolution.
                            }
                        }
                        else {
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
                    }
                    else {
                        throw new Error("Could not resolve filename from arguments");
                    }
                    let possiblePaths = [];
                    if (type === 'task') {
                        if (state) {
                            possiblePaths.push(node_path_1.default.join(agelumPath, 'tasks', state, resolvedFileName));
                        }
                        else {
                            possiblePaths.push(node_path_1.default.join(agelumPath, 'tasks', 'pending', resolvedFileName));
                            possiblePaths.push(node_path_1.default.join(agelumPath, 'tasks', 'doing', resolvedFileName));
                            possiblePaths.push(node_path_1.default.join(agelumPath, 'tasks', 'done', resolvedFileName));
                        }
                    }
                    else {
                        possiblePaths.push(node_path_1.default.join(agelumPath, nonTaskTypeToDir[type], resolvedFileName));
                    }
                    const existingPath = possiblePaths.find(p => node_fs_1.default.existsSync(p));
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
        }
        catch (error) {
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
