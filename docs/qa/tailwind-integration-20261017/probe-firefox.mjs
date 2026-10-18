import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox } from '@playwright/test';
import { reportPath } from './ui-suites.mjs';

const output = reportPath(process.argv[2]);
const evidence = { started: new Date().toISOString(), executablePath: firefox.executablePath(), attempts: 1 };
let browser;
try {
  // Playwright creates its own temporary profile. No channel, real URL or user
  // profile is involved. This preflight does not certify any GUI test.
  browser = await firefox.launch({ headless: true });
  evidence.version = browser.version();
  evidence.available = true;
} catch (error) {
  evidence.available = false;
  evidence.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  evidence.finished = new Date().toISOString();
  await writeFile(resolve(output, 'firefox-preflight.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
