#!/usr/bin/env node
/** CI-only incremental checks; the local `tsc -b` contract remains separate. */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, rmSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolve the installed compiler beside this script, including when a test
// checks an isolated source tree through cwd. Never select a compiler via PATH.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiler = require.resolve('typescript/bin/tsc');
const projectNames = ['tsconfig.app.json', 'tsconfig.node.json'];

function independentProjects(cwd) {
  const diagnostics = [];
  const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => diagnostics.push(diagnostic) };
  const root = ts.getParsedCommandLineOfConfigFile(join(cwd, 'tsconfig.json'), {}, host);
  if (!root || diagnostics.length || root.errors.length || root.fileNames.length) return;
  if (!Array.isArray(root.raw.files) || root.raw.files.length) return;
  const expected = projectNames.map(name => join(cwd, name));
  const references = (root.projectReferences || []).map(reference => ts.resolveProjectReferencePath(reference));
  if (references.length !== expected.length || references.some(reference => !expected.includes(reference)) || new Set(references).size !== expected.length) return;
  const buildInfoPaths = [];
  for (const project of expected) {
    const parsed = ts.getParsedCommandLineOfConfigFile(project, {}, host);
    if (!parsed || diagnostics.length || parsed.errors.length || parsed.projectReferences?.length ||
        parsed.options.incremental !== true || parsed.options.noEmit !== true || !parsed.options.tsBuildInfoFile) return;
    buildInfoPaths.push(resolve(parsed.options.tsBuildInfoFile));
  }
  if (new Set(buildInfoPaths).size !== expected.length) return;
  return expected;
}

function completedStatus(result) {
  if (result.error) throw result.error;
  if (result.signal) {
    const error = new Error(`TypeScript process ended with ${result.signal}; no retry was attempted.`);
    error.signal = result.signal;
    throw error;
  }
  if (!Number.isInteger(result.status)) throw new Error('TypeScript did not report an exit status.');
  return result.status;
}

function replay(file, outputFd) {
  const inputFd = openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let count;
    while ((count = readSync(inputFd, buffer, 0, buffer.length, null)) > 0) {
      let offset = 0;
      while (offset < count) offset += writeSync(outputFd, buffer, offset, count - offset);
    }
  } finally {
    closeSync(inputFd);
  }
}

/**
 * Check both independent projects, even if the first has ordinary diagnostics.
 * A failed check or an unsupported graph uses a full canonical build so that
 * root/config diagnostics and corrupt-cache recovery retain the build contract.
 * Signals and launch failures are infrastructure failures, never retry triggers.
 */
export function runTypecheck({ cwd = process.cwd(), spawn = spawnSync, outputFd = 1 } = {}) {
  cwd = resolve(cwd);
  const invoke = (args, stdio) => completedStatus(spawn(process.execPath, [compiler, ...args], { cwd, stdio }));
  const canonical = () => invoke(['-b', '--force'], 'inherit');
  const projects = independentProjects(cwd);
  if (!projects) return canonical();

  const temporary = mkdtempSync(join(tmpdir(), 'elogistix-typecheck-'));
  const log = join(temporary, 'compiler.log');
  let logFd;
  try {
    logFd = openSync(log, 'w');
    let failed = false;
    for (const project of projects) {
      const status = invoke(['-p', project], ['inherit', logFd, logFd]);
      if (status !== 0) failed = true;
    }
    closeSync(logFd);
    logFd = undefined;
    // Do not duplicate partial diagnostics or publish an internal cache crash
    // when the canonical build can regenerate that disposable state.
    if (failed) return canonical();
    replay(log, outputFd);
    return 0;
  } finally {
    if (logFd !== undefined) closeSync(logFd);
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = runTypecheck();
  } catch (error) {
    console.error(`CI TypeScript check failed: ${error.message}`);
    process.exitCode = 1;
    if (error.signal) process.kill(process.pid, error.signal);
  }
}
