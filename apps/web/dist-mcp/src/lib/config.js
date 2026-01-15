"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgelumConfig = getAgelumConfig;
exports.saveAgelumConfig = saveAgelumConfig;
exports.ensureRootGitDirectory = ensureRootGitDirectory;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const CONFIG_DIR = node_path_1.default.join(node_os_1.default.homedir(), '.agelum');
const CONFIG_FILE = node_path_1.default.join(CONFIG_DIR, 'config.json');
function getAgelumConfig() {
    try {
        if (!node_fs_1.default.existsSync(CONFIG_FILE)) {
            return null;
        }
        const content = node_fs_1.default.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('Error reading Agelum config:', error);
        return null;
    }
}
function saveAgelumConfig(config) {
    try {
        if (!node_fs_1.default.existsSync(CONFIG_DIR)) {
            node_fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        node_fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    }
    catch (error) {
        console.error('Error saving Agelum config:', error);
        throw error;
    }
}
function ensureRootGitDirectory() {
    const config = getAgelumConfig();
    if (config?.rootGitDirectory) {
        return config.rootGitDirectory;
    }
    // Default fallback (legacy behavior)
    return node_path_1.default.resolve(process.cwd(), '../../..');
}
