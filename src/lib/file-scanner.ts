/**
 * File Scanner for Obsidian-style file graph
 *
 * Scans source files in the codebase to build a graph visualization
 * with health status (green/yellow/gold/red) based on:
 * - Bug tracker mentions (red)
 * - Test coverage (gold)
 * - Default (green)
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, extname, relative, resolve } from 'node:path';
import fg from 'fast-glob';
import type { Graph3DTheme } from './config.js';

export type HealthStatus = 'green' | 'yellow' | 'gold' | 'red';

export interface FileNode {
  id: string;           // Relative file path
  label: string;        // Display name (filename)
  type: 'file';
  directory: string;    // Parent directory
  size: number;         // Line count
  health: HealthStatus;
  url: string;          // Link to file detail (or external)
  imports: string[];    // Files this imports
  importedBy: string[]; // Files that import this
}

export interface FileLink {
  source: string;
  target: string;
  type: 'import';
}

export interface FileGraphData {
  nodes: FileNode[];
  links: FileLink[];
  directories: string[];
  stats: {
    totalFiles: number;
    totalLines: number;
    healthCounts: Record<HealthStatus, number>;
  };
}

// Regex to extract import paths from TypeScript/JavaScript
const IMPORT_REGEX = /(?:import|export)\s+(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]/g;

// Regex to extract file paths from bug tracker markdown tables
// Matches patterns like: `backend/src/lib/auth.ts:4` or `room-votes.ts`
const BUG_FILE_REGEX = /`([a-zA-Z0-9_/.-]+\.(?:ts|tsx|js|jsx))(?::\d+(?:-\d+)?)?`/g;

/**
 * Parse the security bug tracker markdown to extract files with known bugs
 */
function parseBugTracker(wikiDir: string): Set<string> {
  const buggedFiles = new Set<string>();

  const bugTrackerPath = join(wikiDir, 'wiki', '05-operations', 'security-bug-tracker.md');
  if (!existsSync(bugTrackerPath)) {
    return buggedFiles;
  }

  const content = readFileSync(bugTrackerPath, 'utf-8');

  // Split by sections to only process "Open" items
  const lines = content.split('\n');
  let inOpenSection = false;

  for (const line of lines) {
    // Track if we're in an open item row
    if (line.includes('**Open**')) {
      inOpenSection = true;
    }

    if (inOpenSection || line.includes('**Open**')) {
      // Extract file paths from the line
      const matches = line.matchAll(BUG_FILE_REGEX);
      for (const match of matches) {
        const filePath = match[1];
        // Normalize - add common prefixes if needed
        buggedFiles.add(normalizeFilePath(filePath));
      }
    }

    // Reset on table row separator or new section
    if (line.startsWith('|') && !line.includes('**Open**')) {
      inOpenSection = false;
    }
  }

  return buggedFiles;
}

/**
 * Normalize file path for matching
 * - Handle partial paths like "auth.ts" -> match any file ending with it
 */
function normalizeFilePath(path: string): string {
  // Remove line numbers if present
  const colonIdx = path.indexOf(':');
  if (colonIdx !== -1) {
    return path.slice(0, colonIdx);
  }
  return path;
}

/**
 * Check if a file path matches a bugged file pattern
 */
function matchesBugPattern(filePath: string, buggedFiles: Set<string>): boolean {
  const normalizedPath = normalizeFilePath(filePath);

  // Direct match
  if (buggedFiles.has(normalizedPath)) {
    return true;
  }

  // Check if any bug pattern is a suffix of the file path
  for (const bugPath of buggedFiles) {
    if (normalizedPath.endsWith(bugPath) || normalizedPath.endsWith('/' + bugPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Find test files and map them to their source files
 */
function findTestedFiles(files: string[]): Set<string> {
  const testedFiles = new Set<string>();

  for (const file of files) {
    // Match patterns like foo.test.ts -> foo.ts
    const testMatch = file.match(/^(.+)\.test\.(ts|tsx|js|jsx)$/);
    if (testMatch) {
      const sourceFile = `${testMatch[1]}.${testMatch[2]}`;
      testedFiles.add(sourceFile);
    }

    // Match patterns like __tests__/foo.ts -> foo.ts (in parent dir)
    if (file.includes('__tests__/')) {
      const sourcePath = file.replace('__tests__/', '');
      testedFiles.add(sourcePath);
    }
  }

  return testedFiles;
}

/**
 * Count lines in a file
 */
function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Extract import paths from a TypeScript/JavaScript file
 */
function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports: string[] = [];

    const matches = content.matchAll(IMPORT_REGEX);
    for (const match of matches) {
      const importPath = match[1];
      // Only include relative imports (not npm packages)
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.push(importPath);
      }
    }

    return imports;
  } catch {
    return [];
  }
}

/**
 * Resolve a relative import path to an absolute file path
 */
function resolveImportPath(fromFile: string, importPath: string, allFiles: string[]): string | null {
  const fromDir = dirname(fromFile);

  // Try different extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  // Remove extension if present
  let basePath = importPath;
  if (/\.(ts|tsx|js|jsx)$/.test(importPath)) {
    basePath = importPath.replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  // Resolve relative path
  const resolved = resolve(fromDir, basePath);

  // Try finding the file with various extensions
  for (const ext of extensions) {
    const candidate = resolved + ext;
    // Check if this matches any of our files
    const relCandidate = relative(process.cwd(), candidate).replace(/\\/g, '/');
    if (allFiles.includes(relCandidate)) {
      return relCandidate;
    }
  }

  // Try without extension (exact match)
  const relResolved = relative(process.cwd(), resolved).replace(/\\/g, '/');
  if (allFiles.includes(relResolved)) {
    return relResolved;
  }

  return null;
}

/**
 * Determine health status of a file
 */
function determineHealth(
  filePath: string,
  buggedFiles: Set<string>,
  testedFiles: Set<string>,
  healthOverrides?: Record<string, HealthStatus>
): HealthStatus {
  // Manual override takes priority
  if (healthOverrides?.[filePath]) {
    return healthOverrides[filePath];
  }

  // Bug tracker mention = red (highest priority)
  if (matchesBugPattern(filePath, buggedFiles)) {
    return 'red';
  }

  // Has test file = gold
  if (testedFiles.has(filePath)) {
    return 'gold';
  }

  // Default = green
  return 'green';
}

/**
 * Scan source files and build graph data
 */
export async function scanSourceFiles(
  projectRoot: string,
  wikiDir: string,
  options: Graph3DTheme
): Promise<FileGraphData> {
  const sourceRoot = resolve(projectRoot, options.sourceRoot || '.');

  // Default include patterns
  const includePatterns = options.include || [
    'backend/src/**/*.ts',
    'frontend/src/**/*.tsx',
    'frontend/src/**/*.ts',
    'autocall/src/**/*.ts',
    'scraper/src/**/*.ts',
  ];

  // Default exclude patterns
  const excludePatterns = options.exclude || [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.d.ts',
    '**/generated/**',
  ];

  // Scan files
  const files = await fg(includePatterns, {
    cwd: sourceRoot,
    ignore: excludePatterns,
    absolute: false,
    onlyFiles: true,
  });

  // Parse bug tracker
  const buggedFiles = parseBugTracker(wikiDir);

  // Find tested files
  const testedFiles = findTestedFiles(files);

  // Build nodes
  const nodes: FileNode[] = [];
  const directories = new Set<string>();
  const healthCounts: Record<HealthStatus, number> = { green: 0, yellow: 0, gold: 0, red: 0 };
  let totalLines = 0;

  // First pass: create nodes
  for (const file of files) {
    const absPath = join(sourceRoot, file);
    const lineCount = countLines(absPath);
    const dir = dirname(file);
    const health = determineHealth(file, buggedFiles, testedFiles, options.healthOverrides);

    directories.add(dir);
    healthCounts[health]++;
    totalLines += lineCount;

    nodes.push({
      id: file,
      label: basename(file),
      type: 'file',
      directory: dir,
      size: lineCount,
      health,
      url: `/explain?file=${encodeURIComponent(file)}`,
      imports: [],
      importedBy: [],
    });
  }

  // Second pass: build import links
  const links: FileLink[] = [];
  const fileSet = new Set(files);

  for (const node of nodes) {
    const absPath = join(sourceRoot, node.id);
    const rawImports = extractImports(absPath);

    for (const imp of rawImports) {
      const resolvedTarget = resolveImportPath(node.id, imp, files);
      if (resolvedTarget && fileSet.has(resolvedTarget) && resolvedTarget !== node.id) {
        node.imports.push(resolvedTarget);

        // Find target node and add importedBy
        const targetNode = nodes.find(n => n.id === resolvedTarget);
        if (targetNode) {
          targetNode.importedBy.push(node.id);
        }

        // Add link (dedupe by checking existing)
        const linkKey = `${node.id}->${resolvedTarget}`;
        const existingLink = links.find(l => l.source === node.id && l.target === resolvedTarget);
        if (!existingLink) {
          links.push({
            source: node.id,
            target: resolvedTarget,
            type: 'import',
          });
        }
      }
    }
  }

  return {
    nodes,
    links,
    directories: Array.from(directories).sort(),
    stats: {
      totalFiles: nodes.length,
      totalLines,
      healthCounts,
    },
  };
}

/**
 * Get health color for CSS
 */
export function healthColor(health: HealthStatus): string {
  switch (health) {
    case 'green': return '#22c55e';  // Green - healthy
    case 'yellow': return '#eab308'; // Yellow - untested
    case 'gold': return '#f59e0b';   // Gold/Orange - tested
    case 'red': return '#ef4444';    // Red - has bugs
    default: return '#6b7280';
  }
}

/**
 * Get health label for display
 */
export function healthLabel(health: HealthStatus): string {
  switch (health) {
    case 'green': return 'Healthy';
    case 'yellow': return 'Untested';
    case 'gold': return 'Tested';
    case 'red': return 'Has bugs';
    default: return 'Unknown';
  }
}
