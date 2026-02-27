import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

const GIT_BASE_PATH = process.env.DISTILL_GIT_BASE_PATH || '/data/repos';

export interface GitConfig {
  ai_instructions?: string[];
  context_files?: string[];
  branches?: {
    important?: string[];
    ignore?: string[];
  };
  quick_questions?: string[];
  chat_presets?: Array<{
    name: string;
    system_prompt: string;
  }>;
  structure?: {
    frontend?: {
      routing?: {
        type: 'nextjs' | 'react';
        directory?: string;
        routes_file?: string;
      };
    };
    database?: {
      schemas?: string[];
    };
  };
  // Legacy fields (keep for backwards compatibility)
  pages?: Array<{
    title: string;
    path: string;
  }>;
  branch_policy?: {
    allow?: string[];
    deny?: string[];
  };
}

export async function ensureGitBasePath() {
  try {
    await fs.mkdir(GIT_BASE_PATH, { recursive: true });
  } catch (error) {
    console.error('Failed to create git base path:', error);
  }
}

export function getRepoPath(repoId: string): string {
  return path.join(GIT_BASE_PATH, repoId);
}

export function getMirrorPath(repoId: string): string {
  return path.join(getRepoPath(repoId), 'mirror.git');
}

export async function cloneMirror(
  repoId: string,
  repoUrl: string,
  token?: string
): Promise<void> {
  await ensureGitBasePath();
  const repoPath = getRepoPath(repoId);
  const mirrorPath = getMirrorPath(repoId);

  await fs.mkdir(repoPath, { recursive: true });

  const urlWithToken = token ? injectToken(repoUrl, token) : repoUrl;

  try {
    await execAsync(`git clone --mirror "${urlWithToken}" "${mirrorPath}"`);
  } catch (error: any) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

export async function fetchMirror(
  repoId: string,
  repoUrl: string,
  token?: string
): Promise<void> {
  const mirrorPath = getMirrorPath(repoId);

  const mirrorExists = await fs
    .access(mirrorPath)
    .then(() => true)
    .catch(() => false);

  if (!mirrorExists) {
    await cloneMirror(repoId, repoUrl, token);
    return;
  }

  try {
    await execAsync(`git --git-dir="${mirrorPath}" fetch --prune --tags`);
  } catch (error: any) {
    throw new Error(`Failed to fetch repository: ${error.message}`);
  }
}

export async function resolveBranchToSha(
  repoId: string,
  branch: string
): Promise<string> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    // Try refs/heads/ first (for mirror clones)
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" rev-parse "refs/heads/${branch}"`
    );
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to resolve branch ${branch}: ${error.message}`);
  }
}

export async function readFile(
  repoId: string,
  sha: string,
  filePath: string
): Promise<string> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" show "${sha}:${filePath}"`
    );
    return stdout;
  } catch (error: any) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

export async function listBranches(repoId: string): Promise<string[]> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    // For mirror clones, use local branches (which are the mirrored remote branches)
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" branch`
    );

    const branches = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.includes('->'))
      .map((line) => line.replace(/^\*\s*/, '')); // Remove leading * from current branch

    return branches;
  } catch (error: any) {
    throw new Error(`Failed to list branches: ${error.message}`);
  }
}

export async function detectDefaultBranch(repoId: string): Promise<string> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    // For mirror clones, check HEAD directly
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" symbolic-ref HEAD`
    );
    const defaultBranch = stdout.trim().replace('refs/heads/', '');
    return defaultBranch;
  } catch {
    const branches = await listBranches(repoId);

    if (branches.includes('main')) return 'main';
    if (branches.includes('master')) return 'master';
    if (branches.length > 0) return branches[0];

    throw new Error('No branches found in repository');
  }
}

export async function parseDistillConfig(
  repoId: string,
  sha: string
): Promise<GitConfig | null> {
  try {
    const content = await readFile(repoId, sha, '.distill.yaml');
    const config = yaml.load(content) as GitConfig;
    return config;
  } catch {
    return null;
  }
}

export async function getFileLastCommit(
  repoId: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" log -n 1 --format="%H" "refs/heads/${branch}" -- "${filePath}"`
    );
    return stdout.trim() || null;
  } catch (error: any) {
    console.error(`Failed to get last commit for ${filePath}:`, error.message);
    return null;
  }
}

export async function buildRepoContext(
  repoId: string,
  branch: string,
  config: GitConfig
): Promise<{ context: string; fileCommits: { [path: string]: string } }> {
  const commitSha = await resolveBranchToSha(repoId, branch);
  let context = '';
  const fileCommits: { [path: string]: string } = {};

  // Track .distill.yaml itself
  const yamlCommit = await getFileLastCommit(repoId, branch, '.distill.yaml');
  if (yamlCommit) {
    fileCommits['.distill.yaml'] = yamlCommit;
  }

  // Add AI instructions if present
  if (config.ai_instructions && config.ai_instructions.length > 0) {
    context += '\n## Repository Guidelines\n\n';
    config.ai_instructions.forEach((instruction) => {
      context += `- ${instruction}\n`;
    });
  }

  // Add context files if present
  if (config.context_files && config.context_files.length > 0) {
    context += '\n## Important Documentation\n\n';

    for (const filePath of config.context_files) {
      try {
        const fileContent = await readFile(repoId, commitSha, filePath);
        const lastCommit = await getFileLastCommit(repoId, branch, filePath);

        if (lastCommit) {
          fileCommits[filePath] = lastCommit;
        }

        context += `### ${filePath}\n\n${fileContent}\n\n---\n\n`;
      } catch (error: any) {
        console.error(`Failed to read context file ${filePath}:`, error.message);
      }
    }
  }

  return { context, fileCommits };
}

export async function listFiles(
  repoId: string,
  sha: string,
  directory: string = ''
): Promise<string[]> {
  const mirrorPath = getMirrorPath(repoId);

  try {
    // Use '.' instead of empty string for git pathspec
    const pathspec = directory || '.';
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" ls-tree -r --name-only "${sha}" "${pathspec}"`
    );
    return stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.trim());
  } catch (error: any) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

function injectToken(url: string, token: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.username = token;
    urlObj.password = '';
    return urlObj.toString();
  } catch {
    return url;
  }
}
