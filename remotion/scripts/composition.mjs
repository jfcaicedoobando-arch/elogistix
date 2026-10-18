import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, selectComposition } from "@remotion/renderer";

export const projectDir = fileURLToPath(new URL("../", import.meta.url));

export async function withComposition(run) {
  const browserExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!browserExecutable) {
    throw new Error("Set PUPPETEER_EXECUTABLE_PATH to an existing isolated Chromium executable (see README).");
  }
  await access(browserExecutable);
  const serveUrl = await bundle({
    entryPoint: path.join(projectDir, "src/index.ts"),
    publicDir: path.join(projectDir, "public"),
  });
  // Remotion starts a fresh process with its own temporary user-data directory.
  const browser = await openBrowser("chrome", {
    browserExecutable,
    chromeMode: "headless-shell",
  });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: "main",
      puppeteerInstance: browser,
    });
    for (const [key, expected] of Object.entries({
      durationInFrames: 1800, fps: 30, width: 1920, height: 1080,
    })) {
      assert.equal(composition[key], expected, `Unexpected main.${key}`);
    }
    return await run({ composition, serveUrl, puppeteerInstance: browser });
  } finally {
    await browser.close({ silent: false });
  }
}
