// @vitest-environment node
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { HELPER_PATH } from '../../../scripts/ci/nc-publica-replay/source-evidence.mjs';

it('evaluates the exact helper module with no filesystem, environment, subprocess or network effects', () => {
  // A separate process avoids global mocks affecting Vitest. The VM evaluates the
  // untransformed ES module with only its four allowlisted builtin dependencies.
  const probe = `
    import fs from 'node:fs';
    import path from 'node:path';
    import crypto from 'node:crypto';
    import assert from 'node:assert/strict';
    import vm from 'node:vm';
    const code = fs.readFileSync(process.argv[1], 'utf8');
    const calls = [];
    const forbidden = name => () => { calls.push(name); throw new Error('Unexpected ' + name); };
    const methods = new Proxy({}, { get: (_, name) => forbidden('fs.promises.' + String(name)) });
    const guardedFs = new Proxy({}, { get: (_, name) => {
      if (name === 'constants') return fs.constants;
      if (name === 'promises') return methods;
      return forbidden('fs.' + String(name));
    } });
    const environment = new Proxy({}, { get: forbidden('env'), ownKeys: forbidden('env.keys') });
    const context = vm.createContext({ Buffer, process: { env: environment }, fetch: forbidden('fetch'),
      setTimeout: forbidden('timer'), setInterval: forbidden('timer'), queueMicrotask: forbidden('microtask') });
    const builtins = { 'node:fs': guardedFs, 'node:path': path, 'node:crypto': crypto, 'node:assert/strict': assert };
    const target = new vm.SourceTextModule(code, { context, importModuleDynamically: forbidden('dynamic import') });
    await target.link(specifier => {
      assert(Object.hasOwn(builtins, specifier), 'Unexpected import: ' + specifier);
      return new vm.SyntheticModule(['default'], function () { this.setExport('default', builtins[specifier]); }, { context });
    });
    await target.evaluate();
    assert.deepEqual(calls, []);
    console.log(JSON.stringify({ evaluated: true, calls }));
  `;
  const output = execFileSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', probe,
    path.resolve(HELPER_PATH)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  expect(JSON.parse(output)).toEqual({ evaluated: true, calls: [] });
});
