import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.agelum');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AgelumConfig {
  rootGitDirectory: string;
}

export function getAgelumConfig(): AgelumConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading Agelum config:', error);
    return null;
  }
}

export function saveAgelumConfig(config: AgelumConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving Agelum config:', error);
    throw error;
  }
}

export function ensureRootGitDirectory(): string {
  const config = getAgelumConfig();
  if (config?.rootGitDirectory) {
    return config.rootGitDirectory;
  }
  
  // Default fallback (legacy behavior)
  return path.resolve(process.cwd(), '../../..');
}
