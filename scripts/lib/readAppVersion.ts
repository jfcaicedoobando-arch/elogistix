import fs from "fs";
import path from "path";

/**
 * Lee `APP_VERSION` de `src/constants/appVersion.ts` SIN importarlo.
 *
 * Importarlo desde `vite.config.ts` convertía ese archivo en dependencia de la
 * configuración de Vite: cada bump de versión disparaba
 * `[vite] src/constants/appVersion.ts changed, restarting server...`, el
 * reinicio abortaba los imports dinámicos en vuelo y el preview embebido
 * quedaba en blanco (`Failed to fetch dynamically imported module`).
 */
export function readAppVersion(rootDir: string = process.cwd()): string {
  try {
    const file = path.resolve(rootDir, "src/constants/appVersion.ts");
    const src = fs.readFileSync(file, "utf-8");
    const match = /APP_VERSION\s*=\s*["'`]([^"'`]+)["'`]/.exec(src);
    return match?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}
