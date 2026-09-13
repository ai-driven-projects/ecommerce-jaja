#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_PACKAGE_NAME, resolveSkillPaths } from '../../utils/resolve-skill-config.mjs';
import { createSkillRunLogger } from '../../utils/skill-run-log.mjs';
import { createSkillRunOps } from '../../utils/skill-run-ops.mjs';

let activeRunLogger = null;
let activeRunOps = null;

const REQUIRED_SHARED_FILES = [
  'package.json',
  'tsconfig.json',
  'jest.config.ts',
  'src/index.ts',
  'src/base/entity.ts',
  'src/base/index.ts',
  'src/base/result.ts',
  'src/base/result-error.ts',
  'src/base/result-validator.ts',
  'src/base/use-case.ts',
  'src/errors/validation-error.ts',
  'src/base/vo.ts',
  'src/db/create.repository.ts',
  'src/db/crud.repository.ts',
  'src/db/delete.repository.ts',
  'src/db/find-by-id.repository.ts',
  'src/db/index.ts',
  'src/db/transaction.manager.ts',
  'src/db/update.repository.ts',
  'src/query/index.ts',
  'src/query/pagination.dto.ts',
  'src/vo/password.vo.ts',
  'src/vo/index.ts',
  'test/base/domain-errors.test.ts',
  'test/base/entity.test.ts',
  'test/base/result.test.ts',
  'test/base/result-validator.test.ts',
  'test/base/vo.test.ts',
  'test/data/test.entity.ts',
  'test/vo/password.vo.test.ts',
];

function usage() {
  console.log(`Usage:
  node create-shared.mjs [--scope @namespace] [--force] [--run-tests]

Examples:
  node create-shared.mjs
  node create-shared.mjs --scope @namespace
  node create-shared.mjs --force
  node create-shared.mjs --force --run-tests`);
}

function parseArgs(argv) {
  let scope = '';
  let force = false;
  let runTests = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--run-tests') {
      runTests = true;
      continue;
    }

    if (arg === '--scope') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --scope');
      }
      scope = value;
      i += 1;
      continue;
    }

    if (arg === '--target') {
      throw new Error(
        'Option --target is no longer supported. packages/shared must be provisioned as a git submodule.',
      );
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { scope, force, runTests };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  if (!activeRunOps) {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    return;
  }

  await activeRunOps.writeJsonFile(filePath, data, {
    note: path.basename(filePath),
    markRiskOnOverwrite: true,
  });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd, args, cwd) {
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }

  return activeRunOps.runCommand(cmd, args, cwd);
}

function gitCommandArgs(args) {
  return ['-c', 'protocol.file.allow=always', ...args];
}

function toSshUrl(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  return `git@github.com:${match[1]}/${match[2]}.git`;
}

async function installRootDependencies(rootDir) {
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  if (!(await exists(rootPackageJsonPath))) {
    throw new Error(`Root package.json not found at ${rootPackageJsonPath}. Cannot run npm install.`);
  }

  console.log('Installing root dependencies with npm install...');
  await runCommand('npm', ['install'], rootDir);
}

async function ensureSharedContract(sharedDir) {
  const missingFiles = [];

  for (const relativePath of REQUIRED_SHARED_FILES) {
    const absolutePath = path.join(sharedDir, relativePath);
    if (!(await exists(absolutePath))) {
      missingFiles.push(relativePath);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Shared submodule contract broken. Missing required files: ${missingFiles.join(', ')}`,
    );
  }
}

async function listFrontendAndBackendPackageJsonPaths({ rootDir, frontendAppPath, backendAppPath }) {
  const appPaths = [...new Set([frontendAppPath, backendAppPath])];
  const packageJsonPaths = [];

  for (const appPath of appPaths) {
    const packageJsonPath = path.join(rootDir, appPath, 'package.json');
    if (await exists(packageJsonPath)) {
      packageJsonPaths.push(packageJsonPath);
    }
  }

  return packageJsonPaths;
}

async function ensureSharedDependencyOnFrontendAndBackend({
  rootDir,
  sharedPackageName,
  frontendAppPath,
  backendAppPath,
}) {
  const targetPackageJsonPaths = await listFrontendAndBackendPackageJsonPaths({
    rootDir,
    frontendAppPath,
    backendAppPath,
  });

  let changedCount = 0;
  let upsertedCount = 0;

  for (const packageJsonPath of targetPackageJsonPaths) {
    const pkg = await readJson(packageJsonPath);
    if (pkg.name === sharedPackageName) continue;

    const deps = pkg.dependencies ?? {};
    const legacySharedDeps = Object.keys(deps).filter(
      (depName) => depName.endsWith('/shared') && depName !== sharedPackageName,
    );
    let changed = false;

    for (const legacyDepName of legacySharedDeps) {
      delete deps[legacyDepName];
      changed = true;
    }

    pkg.dependencies = deps;
    if (deps[sharedPackageName] !== '*') {
      pkg.dependencies[sharedPackageName] = '*';
      upsertedCount += 1;
      changed = true;
    }

    if (changed) {
      await writeJson(packageJsonPath, pkg);
      changedCount += 1;
    }
  }

  return {
    changedCount,
    upsertedCount,
  };
}

async function isGitRepository(rootDir) {
  return exists(path.join(rootDir, '.git'));
}

async function ensureGitRepository(rootDir, logger) {
  if (await isGitRepository(rootDir)) {
    return;
  }

  console.log('Git repository not detected. Initializing git at workspace root...');
  await runCommand('git', ['init'], rootDir);
  logger.step('Repositório git inicializado automaticamente na raiz do workspace.');
}

async function readGitmodules(rootDir) {
  const gitmodulesPath = path.join(rootDir, '.gitmodules');
  if (!(await exists(gitmodulesPath))) {
    return [];
  }

  const content = await fs.readFile(gitmodulesPath, 'utf8');
  const entries = [];
  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[submodule "(.+)"\]$/);
    if (sectionMatch) {
      current = { name: sectionMatch[1], path: '', url: '' };
      entries.push(current);
      continue;
    }

    if (!current) continue;

    const pathMatch = line.match(/^path\s*=\s*(.+)$/);
    const urlMatch = line.match(/^url\s*=\s*(.+)$/);
    if (pathMatch) current.path = pathMatch[1].trim();
    if (urlMatch) current.url = urlMatch[1].trim();
  }

  return entries.filter((entry) => entry.path);
}

function findSubmoduleEntry(entries, submodulePath) {
  return entries.find((entry) => entry.path.replace(/\\/g, '/') === submodulePath.replace(/\\/g, '/')) ?? null;
}

async function isSubmoduleCheckout(rootDir, submodulePath) {
  const gitPath = path.join(rootDir, submodulePath, '.git');
  if (!(await exists(gitPath))) {
    return false;
  }

  const stat = await fs.stat(gitPath);
  if (stat.isDirectory()) {
    return true;
  }

  const content = await fs.readFile(gitPath, 'utf8');
  return content.trim().startsWith('gitdir:');
}

async function removeSubmodule(rootDir, submodulePath) {
  try {
    await runCommand('git', gitCommandArgs(['submodule', 'deinit', '-f', '--', submodulePath]), rootDir);
  } catch {
    // ignore when submodule was never initialized
  }

  try {
    await runCommand('git', gitCommandArgs(['rm', '-f', '--', submodulePath]), rootDir);
  } catch {
    // ignore when path is not tracked as submodule
  }

  await activeRunOps.removePath(path.join(rootDir, submodulePath), {
    recursive: true,
    force: true,
    markRisk: true,
  });

  const modulePath = path.join(rootDir, '.git', 'modules', submodulePath.replace(/\\/g, '/'));
  if (await exists(modulePath)) {
    await activeRunOps.removePath(modulePath, {
      recursive: true,
      force: true,
      markRisk: true,
    });
  }
}

async function ensureSharedSubmodule({
  rootDir,
  submodulePath,
  submoduleUrl,
  force,
  logger,
}) {
  await ensureGitRepository(rootDir, logger);

  const targetDir = path.join(rootDir, submodulePath);
  const gitmodulesEntries = await readGitmodules(rootDir);
  const existingEntry = findSubmoduleEntry(gitmodulesEntries, submodulePath);
  const dirExists = await exists(targetDir);
  const checkoutIsSubmodule = dirExists ? await isSubmoduleCheckout(rootDir, submodulePath) : false;

  if (existingEntry && existingEntry.url !== submoduleUrl && !force) {
    throw new Error(
      `Submodule at ${submodulePath} is registered with URL ${existingEntry.url}. Expected ${submoduleUrl}. Use --force to replace.`,
    );
  }

  if (dirExists && !existingEntry && !checkoutIsSubmodule) {
    if (!force) {
      throw new Error(
        `Directory ${submodulePath} exists but is not a git submodule. Use --force to replace it with ${submoduleUrl}.`,
      );
    }

    logger.step(`Removendo diretório legado em ${submodulePath} antes de adicionar o submódulo.`);
    await activeRunOps.removePath(targetDir, {
      recursive: true,
      force: true,
      markRisk: true,
    });
  }

  if (force && (existingEntry || checkoutIsSubmodule || dirExists)) {
    logger.step(`Recriando submódulo em ${submodulePath} com --force.`);
    await removeSubmodule(rootDir, submodulePath);
  } else if (existingEntry && existingEntry.url !== submoduleUrl) {
    logger.step(`Substituindo submódulo em ${submodulePath} para apontar para ${submoduleUrl}.`);
    await removeSubmodule(rootDir, submodulePath);
  }

  const refreshedEntry = findSubmoduleEntry(await readGitmodules(rootDir), submodulePath);

  if (!refreshedEntry) {
    const parentDir = path.dirname(targetDir);
    if (parentDir !== rootDir) {
      await activeRunOps.ensureDir(parentDir, {
        note: `preparacao de diretorio para submodulo ${submodulePath}`,
      });
    }

    console.log(`Adding git submodule ${submoduleUrl} at ${submodulePath}...`);
    try {
      await runCommand('git', gitCommandArgs(['submodule', 'add', submoduleUrl, submodulePath]), rootDir);
      logger.step(`Submódulo adicionado: ${submoduleUrl} -> ${submodulePath}.`);
    } catch (error) {
      const sshUrl = toSshUrl(submoduleUrl);
      if (!sshUrl) {
        throw error;
      }

      logger.step(`Falha no submodule via HTTPS; tentando fallback SSH: ${sshUrl}.`);
      await runCommand('git', gitCommandArgs(['submodule', 'add', sshUrl, submodulePath]), rootDir);
      logger.step(`Submódulo adicionado via SSH: ${sshUrl} -> ${submodulePath}.`);
    }
  } else {
    console.log(`Initializing git submodule at ${submodulePath}...`);
    await runCommand('git', gitCommandArgs(['submodule', 'update', '--init', '--recursive', '--', submodulePath]), rootDir);
    logger.step(`Submódulo inicializado/atualizado em ${submodulePath}.`);
  }

  if (!(await exists(path.join(targetDir, 'package.json')))) {
    throw new Error(
      `Submodule checkout at ${submodulePath} is missing package.json. Verify access to ${submoduleUrl} and run git submodule update --init --recursive.`,
    );
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = process.cwd();
  const logger = await createSkillRunLogger({
    rootDir,
    skillName: 'config-shared-core',
    commandArgs: process.argv.slice(2),
  });

  try {
    activeRunLogger = logger;
    activeRunOps = createSkillRunOps({
      rootDir,
      logger,
      dryRun: false,
    });
    const { scope: scopeArg, force, runTests } = parseArgs(process.argv.slice(2));
    const { sharedModulePathRelative, sharedDir, sharedModule, config } = await resolveSkillPaths(rootDir);
    const submoduleUrl = config.defaults.sharedSubmoduleUrl;
    const targetPackageJsonPath = path.join(sharedDir, 'package.json');

    logger.step(`Submódulo alvo: ${sharedModulePathRelative} (${submoduleUrl}).`);

    await ensureSharedSubmodule({
      rootDir,
      submodulePath: sharedModulePathRelative,
      submoduleUrl,
      force,
      logger,
    });

    await ensureSharedContract(sharedDir);
    logger.step('Contrato mínimo do submódulo shared validado com sucesso.');

    // O shared é um submódulo externo com escopo próprio (SHARED_PACKAGE_NAME).
    // Nunca renomear o pacote para o namespace do projeto consumidor.
    const pkg = await readJson(targetPackageJsonPath);
    if (pkg.name !== SHARED_PACKAGE_NAME) {
      throw new Error(
        `Submódulo shared em ${sharedDir} tem nome "${pkg.name}", esperado "${SHARED_PACKAGE_NAME}". ` +
          'Verifique a URL do submódulo (sharedSubmoduleUrl).',
      );
    }
    if (scopeArg) {
      logger.step(`--scope ignorado: o pacote shared mantém o nome fixo ${SHARED_PACKAGE_NAME}.`);
    }
    logger.step(`Nome do pacote shared validado: ${pkg.name}.`);

    console.log(`Shared module ready at: ${sharedDir}`);
    console.log(`Package name: ${pkg.name}`);
    console.log(`Submodule URL: ${submoduleUrl}`);

    const dependencyChanges = await ensureSharedDependencyOnFrontendAndBackend({
      rootDir,
      sharedPackageName: pkg.name,
      frontendAppPath: config.defaults.frontendAppPath,
      backendAppPath: config.defaults.backendAppPath,
    });
    if (dependencyChanges.changedCount > 0) {
      console.log(
        `Synchronized dependency "${pkg.name}: *" on frontend/backend (upserted: ${dependencyChanges.upsertedCount}).`,
      );
      logger.step(
        `Dependência "${pkg.name}: *" sincronizada em frontend/backend (upserted: ${dependencyChanges.upsertedCount}).`,
      );
    } else {
      console.log(`Frontend/backend dependencies already synchronized for "${pkg.name}: *".`);
      logger.step(`Dependência "${pkg.name}: *" já estava sincronizada para frontend/backend.`);
    }

    await installRootDependencies(rootDir);
    logger.step('npm install executado na raiz do projeto.');

    if (runTests) {
      console.log(`Running tests for ${pkg.name}...`);
      await runCommand('npm', ['run', 'test', '-w', pkg.name], rootDir);
      logger.step(`Testes executados para ${pkg.name}.`);
    } else {
      logger.step('Execução de testes não solicitada.');
    }

    await logger.success();
  } catch (error) {
    await logger.failure(error);
    throw error;
  } finally {
    activeRunLogger = null;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
