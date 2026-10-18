import { mkdir } from "node:fs/promises";
import path from "node:path";
import { renderMedia } from "@remotion/renderer";
import { projectDir, withComposition } from "./composition.mjs";

const out = path.resolve(process.env.OUT || path.join(projectDir, "out/demo-libre-carga.mp4"));
await mkdir(path.dirname(out), { recursive: true });

await withComposition(async (options) => {
  let lastPercent = -1;
  await renderMedia({
    ...options,
    codec: "h264",
    outputLocation: out,
    muted: true,
    concurrency: 1,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastPercent) {
        console.log(`${percent}%`);
        lastPercent = percent;
      }
    },
  });
});
console.log("Done:", out);
