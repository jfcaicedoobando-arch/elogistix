#!/usr/bin/env node
// Small synthetic production-policy check. No app config, env file or backend.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const fixtureSource = `
const trace = [];
function mark(label) { trace.push(label); return label; }
console.log(mark('direct-log-argument'));
console.warn(mark('direct-warn-argument'));
console.error(mark('direct-error-argument'));
console.debug(mark('direct-debug-argument'));
console['log'](mark('computed-argument'));
console.log?.(mark('optional-method-argument'));
console?.log(mark('optional-object-argument'));
const method = 'info';
console[method](mark('computed-variable-argument'));
globalThis.console.log(mark('global-property-argument'));
const indirect = console.log;
indirect(mark('indirect-argument'));
function localConsole(console) {
  console.log(mark('shadowed-argument'));
}
localConsole({ log(value) { trace.push('shadowed-call:' + value); } });
function normal(value) {
  debugger;
  trace.push('normal-call:' + value);
  return value * 2;
}
globalThis.__minifierPolicyResult = { trace, result: normal(21) };
`;

const argumentLabels = ['direct-log-argument', 'direct-warn-argument', 'direct-error-argument', 'direct-debug-argument', 'computed-argument', 'optional-method-argument', 'optional-object-argument', 'computed-variable-argument', 'global-property-argument', 'indirect-argument', 'shadowed-argument'];

export function evaluateFixture(code) {
  const calls = [];
  const fakeConsole = Object.fromEntries(['log', 'warn', 'error', 'debug', 'info'].map((name) => [name, (...values) => {
    calls.push({ method: name, values });
  }]));
  const sandbox = { console: fakeConsole };
  vm.runInNewContext(code, sandbox, { timeout: 1000, filename: 'minifier-policy-fixture.js' });
  assert.ok(sandbox.__minifierPolicyResult, 'Fixture must publish a result');
  const observation = JSON.parse(JSON.stringify({ ...sandbox.__minifierPolicyResult, consoleCalls: calls }));
  assert.equal(observation.result, 42, 'Ordinary computation must be retained');
  assert.ok(observation.trace.includes('normal-call:21'), 'Ordinary side effect must be retained');
  return observation;
}

export function assertDirectConsolePolicy(observation, minifier) {
  for (const label of ['direct-log-argument', 'direct-warn-argument', 'direct-error-argument', 'direct-debug-argument']) {
    assert.ok(!observation.trace.includes(label), `${minifier}: drop console must also remove ${label}`);
    assert.ok(!observation.consoleCalls.some((call) => call.values.includes(label)), `${minifier}: direct console call must be removed`);
  }
}

export async function checkPolicies(build) {
  const entry = 'virtual:minifier-policy-fixture';
  const results = {};
  for (const minifier of ['terser', 'oxc']) {
    const config = {
      configFile: false,
      envDir: false,
      logLevel: 'silent',
      publicDir: false,
      plugins: [{
        name: 'minifier-policy-fixture',
        resolveId(id) { if (id === entry) return `\0${entry}`; },
        load(id) { if (id === `\0${entry}`) return fixtureSource; },
        configResolved(resolved) {
          results[minifier].resolved = {
            mode: resolved.mode,
            target: resolved.build.target,
            sourcemap: resolved.build.sourcemap,
            minify: resolved.build.minify,
          };
        },
      }],
      build: {
        write: false,
        emptyOutDir: false,
        copyPublicDir: false,
        sourcemap: false,
        reportCompressedSize: false,
        minify: minifier,
        rolldownOptions: {
          input: entry,
          output: {
            format: 'iife',
            name: 'MinifierPolicyFixture',
            ...(minifier === 'oxc' ? { minify: { compress: { dropConsole: true, dropDebugger: true }, mangle: true, codegen: true } } : {}),
          },
        },
        ...(minifier === 'terser'
          ? { terserOptions: { compress: { drop_console: true, drop_debugger: true } } }
          : {}),
      },
    };
    results[minifier] = {
      ok: false,
      // Vite mutates aliases on its input config; retain the requested config.
      buildConfig: JSON.parse(JSON.stringify({ ...config, plugins: [{ name: 'minifier-policy-fixture' }] })),
    };
    try {
      const result = await build(config);
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) => output.output ?? []);
      const chunks = outputs.filter((output) => output.type === 'chunk');
      assert.equal(chunks.length, 1, `${minifier}: expected exactly one synthetic chunk`);
      const code = chunks[0].code;
      Object.assign(results[minifier], {
        bytes: Buffer.byteLength(code),
        sha256: createHash('sha256').update(code).digest('hex'),
        debuggerRemoved: !/\bdebugger\b/.test(code),
        code,
      });
      // The fixture contains no strings/comments using this keyword; no lexer
      // is needed to establish that its debugger statement was removed.
      assert.ok(results[minifier].debuggerRemoved, `${minifier}: debugger must be removed`);
      const observation = evaluateFixture(code);
      results[minifier].observation = observation;
      results[minifier].cases = Object.fromEntries(argumentLabels.map((label) => [label, {
        argumentEffectObserved: observation.trace.includes(label),
        consoleMethodsObserved: observation.consoleCalls.filter((call) => call.values.includes(label)).map((call) => call.method),
        ...(label === 'shadowed-argument' ? { shadowedCustomCallObserved: observation.trace.includes('shadowed-call:shadowed-argument') } : {}),
      }]));
      assertDirectConsolePolicy(observation, minifier);
      results[minifier].ok = true;
    } catch (error) {
      results[minifier].error = error.stack ?? String(error);
    }
  }
  const targetEquivalent = JSON.stringify(results.terser.resolved?.target) === JSON.stringify(results.oxc.resolved?.target);
  const equal = results.terser.ok && results.oxc.ok && JSON.stringify(results.terser.observation) === JSON.stringify(results.oxc.observation);
  return {
    schemaVersion: 1,
    ok: equal && targetEquivalent,
    scope: 'Synthetic fixture only; equal observations do not prove complete application equivalence.',
    policies: { terser: { drop_console: true, drop_debugger: true }, oxc: { dropConsole: true, dropDebugger: true } },
    target: 'Inherited installed Vite default, matching the application config which has no explicit build.target.',
    resolvedTargetEquivalent: targetEquivalent,
    observationEquivalent: equal,
    fixtureSource,
    results,
  };
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 0 && !(arguments_.length === 2 && arguments_[0] === '--output')) throw new Error('Usage: node policy-fixture.mjs [--output report.json]');
  const { build } = await import('vite');
  const result = await checkPolicies(build);
  const require = createRequire(import.meta.url);
  result.versions = { node: process.version };
  for (const name of ['vite', 'rolldown', 'terser']) {
    result.versions[name] = JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8')).version;
  }
  result.exitCode = result.ok ? 0 : 1;
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (arguments_.length) {
    await mkdir(path.dirname(path.resolve(arguments_[1])), { recursive: true });
    await writeFile(arguments_[1], json);
  }
  process.stdout.write(json);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
