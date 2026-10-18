import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const suites = {
  'audit119-126': { config: 'e2e/visual/audit119-126/playwright.config.ts', vite: 'e2e/visual/audit119-126/vite.config.ts', testDir: 'e2e/visual/audit119-126/specs', port: 8096, expected: 20 },
  'audit136-137': { config: 'e2e/visual/audit136-137/playwright.config.ts', vite: 'e2e/visual/audit136-137/vite.config.ts', testDir: 'e2e/visual/audit136-137/specs', port: 8097, expected: 8 },
  virtualization: { config: 'e2e/visual/virtualization/playwright.config.ts', vite: 'e2e/visual/virtualization/vite.config.ts', testDir: 'e2e/visual/virtualization/specs', port: 8098, expected: 8 },
  'shared-ui': { config: 'playwright.visual.config.ts', vite: 'vite.visual.config.ts', testDir: 'e2e/visual/specs', expected: 16, development: true, readyPath: '/e2e/visual/index.html' },
};

export function reportPath(path) {
  const absolute = resolve(repository, path);
  const child = relative(resolve(repository, 'reports/tailwind-integration'), absolute);
  assert.ok(child && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child), 'Output must be a child of reports/tailwind-integration');
  return absolute;
}

export function suiteDefinition(name) {
  assert.ok(Object.hasOwn(suites, name), `Unknown visual suite: ${name}`);
  return suites[name];
}
