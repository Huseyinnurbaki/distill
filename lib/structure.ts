import { exec } from 'child_process';
import { promisify } from 'util';
import { listFiles, readFile, getMirrorPath } from './git';

const execAsync = promisify(exec);

export interface RouteEntry {
  path: string;
  file: string;
  description?: string;
}

export interface PrismaField {
  name: string;
  type: string;
  optional: boolean;
  isList: boolean;
  attributes: string[];
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
}

export interface SqlTable {
  name: string;
  columns: string[];
}

export interface RoutingStructure {
  type: 'nextjs' | 'react';
  routes?: RouteEntry[];
  content?: string;
}

export interface PrismaSchemaStructure {
  type: 'prisma';
  models: PrismaModel[];
}

export interface SqlSchemaStructure {
  type: 'sql';
  tables: SqlTable[];
}

export interface UnknownSchemaStructure {
  type: 'unknown';
  content: string;
}

export type SchemaStructure = PrismaSchemaStructure | SqlSchemaStructure | UnknownSchemaStructure;
export type StructureData = RoutingStructure | SchemaStructure;

export function buildNextjsRoutes(files: string[], directory: string): RouteEntry[] {
  const normalizedDir = directory.endsWith('/') ? directory.slice(0, -1) : directory;
  const APP_ROUTER_PATTERN = /\/page\.(tsx|ts|jsx|js)$/;
  const EXT_PATTERN = /\.(tsx|ts|jsx|js)$/;

  const dirFiles = files.filter((f) => f.startsWith(normalizedDir + '/'));

  // Auto-detect: App Router uses page.tsx files; Pages Router uses any .tsx file
  const isAppRouter = dirFiles.some((f) => APP_ROUTER_PATTERN.test(f));

  if (isAppRouter) {
    return dirFiles
      .filter((f) => APP_ROUTER_PATTERN.test(f))
      .map((file) => {
        const relative = file.slice(normalizedDir.length + 1);
        const withoutPage = relative
          .replace(/\/page\.(tsx|ts|jsx|js)$/, '')
          .replace(/^page\.(tsx|ts|jsx|js)$/, '');
        const routePath = '/' + withoutPage.replace(/^\//, '');
        const cleanRoute = routePath === '//' ? '/' : routePath.replace(/\/$/, '') || '/';
        return { path: cleanRoute, file };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  // Pages Router: every .tsx/.ts/.jsx/.js file is a route except _app/_document/_error and api/
  return dirFiles
    .filter((f) => {
      if (!EXT_PATTERN.test(f)) return false;
      const relative = f.slice(normalizedDir.length + 1);
      const filename = relative.split('/').pop() ?? '';
      if (filename.startsWith('_')) return false;
      if (relative.startsWith('api/')) return false;
      return true;
    })
    .map((file) => {
      const relative = file.slice(normalizedDir.length + 1);
      const withoutExt = relative.replace(/\.(tsx|ts|jsx|js)$/, '');
      // index files map to their parent path
      const routePath = withoutExt === 'index'
        ? '/'
        : '/' + withoutExt.replace(/\/index$/, '');
      return { path: routePath, file };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function parsePrismaSchema(content: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const scalars = new Set([
    'String', 'Int', 'Float', 'Boolean', 'DateTime',
    'Json', 'Bytes', 'Decimal', 'BigInt',
  ]);

  const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const fields: PrismaField[] = [];

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      // fieldName  Type?[]  @attr
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?(\[\])?/);
      if (!fieldMatch) continue;

      const [, name, baseType, optional, isList] = fieldMatch;

      // Skip relation scalar IDs that shadow a relation field — we include all fields
      const attrs = trimmed.match(/@\w+(\([^)]*\))?/g) ?? [];

      // Only include scalar fields + known relation markers; skip pure relation fields
      // (they're implied by the model reference type)
      if (!scalars.has(baseType) && !attrs.some((a) => a.startsWith('@relation'))) {
        // It's a relation field (e.g. `user User`) — include it but mark
        // separately by keeping its type
      }

      fields.push({
        name,
        type: baseType,
        optional: !!optional,
        isList: !!isList,
        attributes: attrs,
      });
    }

    models.push({ name: modelName, fields });
  }

  return models;
}

export function parseSqlSchema(content: string): SqlTable[] {
  const tables: SqlTable[] = [];
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([^;]+?)\)\s*;/gis;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const columns: string[] = [];
    let depth = 0;
    let current = '';

    for (const ch of body) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;

      if (ch === ',' && depth === 0) {
        const col = current.trim();
        if (col) columns.push(col);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) columns.push(current.trim());

    tables.push({ name, columns });
  }

  return tables;
}

export async function getDirectoryLastCommit(
  repoId: string,
  branch: string,
  directory: string
): Promise<string | null> {
  const mirrorPath = getMirrorPath(repoId);
  try {
    const { stdout } = await execAsync(
      `git --git-dir="${mirrorPath}" log -n 1 --format="%H" "refs/heads/${branch}" -- "${directory}"`
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function scanRouting(
  repoId: string,
  commitSha: string,
  config: { type: 'nextjs' | 'react'; directory?: string; routes_file?: string }
): Promise<RoutingStructure> {
  if (config.directory) {
    const files = await listFiles(repoId, commitSha, config.directory);
    const routes = buildNextjsRoutes(files, config.directory);
    return { type: config.type, routes };
  }
  if (config.routes_file) {
    const content = await readFile(repoId, commitSha, config.routes_file);
    return { type: config.type, content };
  }
  return { type: config.type, routes: [] };
}

export async function scanSchema(
  repoId: string,
  commitSha: string,
  filePath: string
): Promise<SchemaStructure> {
  const content = await readFile(repoId, commitSha, filePath);

  if (filePath.endsWith('.prisma')) {
    return { type: 'prisma', models: parsePrismaSchema(content) };
  }
  if (filePath.endsWith('.sql')) {
    return { type: 'sql', tables: parseSqlSchema(content) };
  }
  return { type: 'unknown', content };
}
