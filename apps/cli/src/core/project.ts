import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProjectInfo {
  rootDir: string;
  name: string;
  backendDir: string | null;
  frontendDir: string | null;
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function hasDependency(pkg: Record<string, unknown> | null, name: string): boolean {
  if (!pkg) return false;
  const groups = ['dependencies', 'devDependencies', 'peerDependencies'];
  return groups.some((group) => {
    const deps = pkg[group];
    return typeof deps === 'object' && deps !== null && name in deps;
  });
}

function isMonorepoRoot(dir: string): boolean {
  const pkg = readJson(path.join(dir, 'package.json'));
  return pkg !== null && 'workspaces' in pkg && isDirectory(path.join(dir, 'apps'));
}

function walkUpForRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  const { root } = path.parse(current);
  while (true) {
    if (isMonorepoRoot(current)) return current;
    if (current === root) return null;
    current = path.dirname(current);
  }
}

/** Raiz do repositório a partir da localização deste arquivo (src/core ou dist/core). */
function rootFromCliLocation(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return walkUpForRoot(here);
}

function isBackendApp(dir: string): boolean {
  const pkg = readJson(path.join(dir, 'package.json'));
  return isFile(path.join(dir, 'nest-cli.json')) || hasDependency(pkg, '@nestjs/core');
}

function isFrontendApp(dir: string): boolean {
  const pkg = readJson(path.join(dir, 'package.json'));
  const hasNextConfig = ['next.config.ts', 'next.config.js', 'next.config.mjs'].some((file) => isFile(path.join(dir, file)));
  return hasNextConfig || hasDependency(pkg, 'next');
}

function findApp(appsDir: string, preferred: string[], detector: (dir: string) => boolean): string | null {
  for (const name of preferred) {
    const candidate = path.join(appsDir, name);
    if (isDirectory(candidate) && detector(candidate)) return candidate;
  }
  if (!isDirectory(appsDir)) return null;
  const match = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsDir, entry.name))
    .find((dir) => detector(dir));
  return match ?? null;
}

export function detectProject(startDir: string = process.cwd()): ProjectInfo {
  const rootDir = walkUpForRoot(startDir) ?? rootFromCliLocation();
  if (!rootDir) {
    throw new Error('Não foi possível localizar a raiz do monorepo (package.json com "workspaces" e pasta apps/).');
  }
  const appsDir = path.join(rootDir, 'apps');
  return {
    rootDir,
    name: path.basename(rootDir),
    backendDir: findApp(appsDir, ['backend', 'api'], isBackendApp),
    frontendDir: findApp(appsDir, ['frontend', 'web'], isFrontendApp),
  };
}
