import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderStill } from "@remotion/renderer";
import { projectDir, withComposition } from "./composition.mjs";

// Midpoints of the six Series.Sequence intervals in MainVideo.tsx.
const scenes = [
  ["hook", 90], ["brand-reveal", 300], ["modules", 600],
  ["kpis", 960], ["route", 1320], ["cta", 1650],
];
const outDir = path.join(projectDir, "out/verification");
await mkdir(outDir, { recursive: true });
await rm(path.join(outDir, "verification.json"), { force: true });

await withComposition(async (options) => {
  for (const [scene, frame] of scenes) {
    await renderStill({
      ...options,
      frame,
      imageFormat: "png",
      output: path.join(outDir, `${scene}.png`),
    });
    console.log(`${scene}: frame ${frame}`);
  }
  const { id, durationInFrames, fps, width, height } = options.composition;
  const { dependencies, devDependencies, packageManager } = JSON.parse(
    await readFile(path.join(projectDir, "package.json"), "utf8"),
  );
  const result = {
    node: process.version, packageManager,
    declaredDependencies: dependencies, declaredDevDependencies: devDependencies,
    composition: { id, durationInFrames, fps, width, height },
    scenes: scenes.map(([scene, frame]) => ({ scene, frame, image: `${scene}.png` })),
  };
  await writeFile(path.join(outDir, "verification.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result.composition));
  console.log(`Verified: ${outDir}`);
});
