import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, basename, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import fg from 'fast-glob';

// === Types ===

export interface ExplainFileEntry {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  lastModified: string;
  directory: string;
}

export interface ExplainZone {
  name: string;
  path: string;
  totalSizeBytes: number;
  fileCount: number;
  zoneType: ZoneType;
  errorCount: number;
  warningCount: number;
  avgChurn: number;
  maxChurn: number;
  files: ExplainFileEntry[];
}

export type ZoneType = 'source' | 'test' | 'config' | 'static' | 'docs' | 'generic';

export interface ImportEdge {
  source: string;
  target: string;
}

export interface DirectoryDependency {
  source: string;
  target: string;
  weight: number;
}

export interface FileChurnEntry {
  path: string;
  commitCount: number;
}

export interface TscError {
  path: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ExplainProjectData {
  projectName: string;
  scanTimestamp: string;
  stats: {
    totalFiles: number;
    totalDirs: number;
    totalSizeBytes: number;
    totalLines: number;
    healthScore: number;
  };
  zones: ExplainZone[];
  zoneDependencies: DirectoryDependency[];
  importEdges: ImportEdge[];
  churn: FileChurnEntry[];
  errors: TscError[];
}

export interface ExplainFileDetail {
  path: string;
  sizeBytes: number;
  lastModified: string;
  lineCount: number;
  extension: string;
  churnScore: number;
  errors: TscError[];
  imports: string[];
  importedBy: string[];
}

// === Zone type detection ===

export function detectZoneType(dirName: string): ZoneType {
  const n = dirName.toLowerCase();
  if (['src', 'lib', 'app', 'packages', 'core', 'modules'].includes(n)) return 'source';
  if (['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress'].includes(n)) return 'test';
  if (['config', 'configs', '.config', 'configuration'].includes(n)) return 'config';
  if (['public', 'static', 'assets', 'media', 'images', 'fonts'].includes(n)) return 'static';
  if (['docs', 'doc', 'documentation', 'wiki', 'guides'].includes(n)) return 'docs';
  return 'generic';
}

// === Import parsing ===

const IMPORT_RE = /(?:import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"])/g;

export function parseImports(content: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const spec = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (spec && (spec.startsWith('.') || spec.startsWith('/'))) {
      imports.push(spec);
    }
  }
  return imports;
}

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte']);
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

export function resolveImportPath(fromFile: string, importSpec: string, projectRoot: string): string | null {
  const fromDir = dirname(join(projectRoot, fromFile));
  const base = resolve(fromDir, importSpec);
  const rel = relative(projectRoot, base).replaceAll('\\', '/');

  // Exact match
  if (existsSync(base) && statSync(base).isFile()) return rel;

  // Try extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(projectRoot, candidate).replaceAll('\\', '/');
    }
  }
  return null;
}

// === Git churn ===

export function getChurnData(projectRoot: string): FileChurnEntry[] {
  try {
    const output = execSync('git log --format="" --name-only -100', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const counts = new Map<string, number>();
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([path, commitCount]) => ({ path, commitCount }))
      .sort((a, b) => b.commitCount - a.commitCount);
  } catch {
    return [];
  }
}

// === TSC errors ===

const TSC_ERROR_RE = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;

export function getTscErrors(projectRoot: string): TscError[] {
  if (!existsSync(join(projectRoot, 'tsconfig.json'))) return [];
  try {
    execSync('npx tsc --noEmit', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return []; // No errors
  } catch (err: any) {
    const output: string = err.stdout ?? err.stderr ?? '';
    const errors: TscError[] = [];
    for (const line of output.split('\n')) {
      const match = TSC_ERROR_RE.exec(line.trim());
      if (match) {
        const filePath = relative(projectRoot, match[1]).replaceAll('\\', '/');
        errors.push({
          path: filePath,
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: match[4] as 'error' | 'warning',
          code: match[5],
          message: match[6],
        });
      }
    }
    return errors;
  }
}

// === Line counter ===

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

// === Main scanner ===

export async function scanProject(projectRoot: string, projectName: string): Promise<ExplainProjectData> {
  // 1. Discover files
  const rawFiles = await fg('**/*', {
    cwd: projectRoot,
    onlyFiles: true,
    dot: false,
    ignore: [
      'node_modules/**', '.git/**', 'dist/**', 'build/**', '.brandwiki/**',
      'coverage/**', '.next/**', '.nuxt/**', '__pycache__/**',
      '*.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '**/*.map', '**/*.min.js', '**/*.min.css',
    ],
  });

  // 2. Collect file metadata
  const fileEntries: ExplainFileEntry[] = [];
  let totalLines = 0;

  for (const relPath of rawFiles) {
    const absPath = join(projectRoot, relPath);
    const normalPath = relPath.replaceAll('\\', '/');
    try {
      const stat = statSync(absPath);
      const lines = CODE_EXTENSIONS.has(extname(relPath)) ? countLines(absPath) : 0;
      totalLines += lines;
      fileEntries.push({
        path: normalPath,
        name: basename(relPath),
        extension: extname(relPath),
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        directory: dirname(normalPath) === '.' ? '' : dirname(normalPath),
      });
    } catch {
      // Skip inaccessible files
    }
  }

  // 3. Build import graph
  const importEdges: ImportEdge[] = [];
  for (const file of fileEntries) {
    if (!CODE_EXTENSIONS.has(file.extension)) continue;
    try {
      const content = readFileSync(join(projectRoot, file.path), 'utf-8');
      const imports = parseImports(content);
      for (const spec of imports) {
        const resolved = resolveImportPath(file.path, spec, projectRoot);
        if (resolved && resolved !== file.path) {
          importEdges.push({ source: file.path, target: resolved });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // 4. Get git churn + tsc errors
  const churn = getChurnData(projectRoot);
  const errors = getTscErrors(projectRoot);

  const churnMap = new Map(churn.map((c) => [c.path, c.commitCount]));
  const errorsByFile = new Map<string, TscError[]>();
  for (const e of errors) {
    if (!errorsByFile.has(e.path)) errorsByFile.set(e.path, []);
    errorsByFile.get(e.path)!.push(e);
  }

  // 5. Group into zones (top-level directories + root files)
  const topLevelDirs = new Set<string>();
  const rootFiles: ExplainFileEntry[] = [];
  for (const f of fileEntries) {
    const topDir = f.path.includes('/') ? f.path.split('/')[0] : '';
    if (topDir) {
      topLevelDirs.add(topDir);
    } else {
      rootFiles.push(f);
    }
  }

  const zones: ExplainZone[] = [];

  for (const dir of topLevelDirs) {
    const zoneFiles = fileEntries.filter((f) => f.path.startsWith(dir + '/'));
    const churns = zoneFiles.map((f) => churnMap.get(f.path) ?? 0);
    const zoneErrors = zoneFiles.reduce((sum, f) => sum + (errorsByFile.get(f.path)?.filter((e) => e.severity === 'error').length ?? 0), 0);
    const zoneWarnings = zoneFiles.reduce((sum, f) => sum + (errorsByFile.get(f.path)?.filter((e) => e.severity === 'warning').length ?? 0), 0);

    zones.push({
      name: dir,
      path: dir,
      totalSizeBytes: zoneFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
      fileCount: zoneFiles.length,
      zoneType: detectZoneType(dir),
      errorCount: zoneErrors,
      warningCount: zoneWarnings,
      avgChurn: churns.length > 0 ? churns.reduce((a, b) => a + b, 0) / churns.length : 0,
      maxChurn: churns.length > 0 ? Math.max(...churns) : 0,
      files: zoneFiles,
    });
  }

  // Root files as a special zone
  if (rootFiles.length > 0) {
    const churns = rootFiles.map((f) => churnMap.get(f.path) ?? 0);
    zones.push({
      name: '.',
      path: '.',
      totalSizeBytes: rootFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
      fileCount: rootFiles.length,
      zoneType: 'config',
      errorCount: rootFiles.reduce((sum, f) => sum + (errorsByFile.get(f.path)?.filter((e) => e.severity === 'error').length ?? 0), 0),
      warningCount: rootFiles.reduce((sum, f) => sum + (errorsByFile.get(f.path)?.filter((e) => e.severity === 'warning').length ?? 0), 0),
      avgChurn: churns.length > 0 ? churns.reduce((a, b) => a + b, 0) / churns.length : 0,
      maxChurn: churns.length > 0 ? Math.max(...churns) : 0,
      files: rootFiles,
    });
  }

  // Sort zones largest first
  zones.sort((a, b) => b.totalSizeBytes - a.totalSizeBytes);

  // 6. Build zone-to-zone dependencies
  const depMap = new Map<string, number>();
  for (const edge of importEdges) {
    const srcZone = edge.source.includes('/') ? edge.source.split('/')[0] : '.';
    const tgtZone = edge.target.includes('/') ? edge.target.split('/')[0] : '.';
    if (srcZone === tgtZone) continue;
    const key = `${srcZone}->${tgtZone}`;
    depMap.set(key, (depMap.get(key) ?? 0) + 1);
  }
  const zoneDependencies: DirectoryDependency[] = Array.from(depMap.entries()).map(([key, weight]) => {
    const [source, target] = key.split('->');
    return { source, target, weight };
  });

  // 7. Compute health score
  const filesWithErrors = new Set(errors.filter((e) => e.severity === 'error').map((e) => e.path)).size;
  const healthScore = fileEntries.length > 0
    ? Math.round(((fileEntries.length - filesWithErrors) / fileEntries.length) * 100)
    : 100;

  const allDirs = new Set(fileEntries.map((f) => f.directory).filter(Boolean));

  return {
    projectName,
    scanTimestamp: new Date().toISOString(),
    stats: {
      totalFiles: fileEntries.length,
      totalDirs: allDirs.size,
      totalSizeBytes: fileEntries.reduce((sum, f) => sum + f.sizeBytes, 0),
      totalLines,
      healthScore,
    },
    zones,
    zoneDependencies,
    importEdges,
    churn,
    errors,
  };
}

// === File detail (on-demand) ===

export function getFileDetail(
  filePath: string,
  projectRoot: string,
  data: ExplainProjectData,
): ExplainFileDetail | null {
  const absPath = join(projectRoot, filePath);
  if (!existsSync(absPath)) return null;

  const stat = statSync(absPath);
  const lineCount = countLines(absPath);
  const churnEntry = data.churn.find((c) => c.path === filePath);
  const fileErrors = data.errors.filter((e) => e.path === filePath);
  const imports = data.importEdges.filter((e) => e.source === filePath).map((e) => e.target);
  const importedBy = data.importEdges.filter((e) => e.target === filePath).map((e) => e.source);

  return {
    path: filePath,
    sizeBytes: stat.size,
    lastModified: stat.mtime.toISOString(),
    lineCount,
    extension: extname(filePath),
    churnScore: churnEntry?.commitCount ?? 0,
    errors: fileErrors,
    imports,
    importedBy,
  };
}
