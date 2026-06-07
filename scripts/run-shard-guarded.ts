/**
 * scripts/run-shard-guarded.ts
 *
 * Wrapper que ejecuta Vitest con un watchdog externo y reporta el archivo
 * culpable cuando un test file excede un timeout duro (cubre cuelgues en
 * carga de módulo / colección, donde `testTimeout` interno de Vitest no
 * dispara).
 *
 * Uso:
 *   bun scripts/run-shard-guarded.ts [--file-timeout=90000] [--idle-timeout=60000] -- <comando vitest...>
 *
 * Args propios (opcionales) ANTES de `--`:
 *   --file-timeout=MS   Tiempo máx en un mismo archivo (default 90000).
 *   --idle-timeout=MS   Tiempo máx sin ninguna línea de stdout (default 60000).
 *
 * Todo lo que va después de `--` se ejecuta tal cual como el comando real.
 * Exit code 124 (estilo `timeout(1)`) cuando se dispara el watchdog.
 */

import { spawn } from "node:child_process";
import readline from "node:readline";

const DEFAULT_FILE_TIMEOUT_MS = 90_000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 5_000;

function parseArgs(argv: string[]): {
  fileTimeoutMs: number;
  idleTimeoutMs: number;
  command: string[];
} {
  const sepIdx = argv.indexOf("--");
  const ownArgs = sepIdx === -1 ? [] : argv.slice(0, sepIdx);
  const command = sepIdx === -1 ? argv.slice() : argv.slice(sepIdx + 1);

  let fileTimeoutMs = DEFAULT_FILE_TIMEOUT_MS;
  let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;

  for (const arg of ownArgs) {
    const fileMatch = arg.match(/^--file-timeout=(\d+)$/);
    if (fileMatch) {
      fileTimeoutMs = Number(fileMatch[1]);
      continue;
    }
    const idleMatch = arg.match(/^--idle-timeout=(\d+)$/);
    if (idleMatch) {
      idleTimeoutMs = Number(idleMatch[1]);
      continue;
    }
    // Args desconocidos antes del `--` los pasamos al comando para no romper
    // CI si alguien agrega un flag de vitest sin separador.
    command.unshift(arg);
  }

  if (command.length === 0) {
    console.error("[run-shard-guarded] No command provided after `--`.");
    process.exit(2);
  }

  return { fileTimeoutMs, idleTimeoutMs, command };
}

// Detecta una ruta de archivo de test al inicio de la línea o tras símbolos
// de estado de Vitest (✓, ✗, ❯, ↓, ·). Ej:
//   " ✓ src/foo/__tests__/bar.test.ts > suite > caso 12ms"
//   " ❯ src/foo/__tests__/bar.test.ts (3)"
const TEST_FILE_REGEX = /(src\/[A-Za-z0-9_\-./]+\.(?:test|spec)\.(?:ts|tsx))/;

function extractTestFile(line: string): string | null {
  const m = line.match(TEST_FILE_REGEX);
  return m ? m[1] : null;
}

function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function printTimeoutBanner(opts: {
  reason: string;
  currentFile: string | null;
  lastLine: string;
  fileElapsedMs: number;
  idleElapsedMs: number;
}): void {
  const bar = "─".repeat(60);
  process.stderr.write(`\n⏱️  HARD TIMEOUT  ${bar}\n`);
  process.stderr.write(`  Reason:          ${opts.reason}\n`);
  process.stderr.write(`  Last file:       ${opts.currentFile ?? "(none yet — hang during collect)"}\n`);
  process.stderr.write(`  Elapsed in file: ${fmtSeconds(opts.fileElapsedMs)}\n`);
  process.stderr.write(`  Idle for:        ${fmtSeconds(opts.idleElapsedMs)}\n`);
  process.stderr.write(`  Last stdout line:\n    ${opts.lastLine || "(no output captured)"}\n`);
  process.stderr.write(`${bar}\n\n`);
}

function main(): void {
  const { fileTimeoutMs, idleTimeoutMs, command } = parseArgs(process.argv.slice(2));

  console.log(
    `[run-shard-guarded] file-timeout=${fileTimeoutMs}ms idle-timeout=${idleTimeoutMs}ms`,
  );
  console.log(`[run-shard-guarded] exec: ${command.join(" ")}`);

  const child = spawn(command[0], command.slice(1), {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  let currentFile: string | null = null;
  let fileStartedAt = Date.now();
  let lastActivityAt = Date.now();
  let lastLine = "";
  let killed = false;

  const handleLine = (line: string, stream: "stdout" | "stderr") => {
    lastActivityAt = Date.now();
    if (line.length > 0) lastLine = line;
    const target = stream === "stdout" ? process.stdout : process.stderr;
    target.write(`${line}\n`);

    const detected = extractTestFile(line);
    if (detected && detected !== currentFile) {
      currentFile = detected;
      fileStartedAt = Date.now();
    }
  };

  const rlOut = readline.createInterface({ input: child.stdout! });
  const rlErr = readline.createInterface({ input: child.stderr! });
  rlOut.on("line", (l) => handleLine(l, "stdout"));
  rlErr.on("line", (l) => handleLine(l, "stderr"));

  const watchdog = setInterval(() => {
    if (killed) return;
    const now = Date.now();
    const fileElapsed = now - fileStartedAt;
    const idleElapsed = now - lastActivityAt;

    let reason: string | null = null;
    if (currentFile && fileElapsed > fileTimeoutMs) {
      reason = `file exceeded ${fmtSeconds(fileTimeoutMs)}`;
    } else if (idleElapsed > idleTimeoutMs) {
      reason = `no stdout activity for ${fmtSeconds(idleTimeoutMs)}`;
    }

    if (reason) {
      killed = true;
      printTimeoutBanner({
        reason,
        currentFile,
        lastLine,
        fileElapsedMs: fileElapsed,
        idleElapsedMs: idleElapsed,
      });
      clearInterval(watchdog);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        process.exit(124);
      }, KILL_GRACE_MS).unref();
    }
  }, 1_000);

  child.on("exit", (code, signal) => {
    clearInterval(watchdog);
    if (killed) return;
    if (signal) {
      console.error(`[run-shard-guarded] child killed by signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    clearInterval(watchdog);
    console.error(`[run-shard-guarded] spawn error: ${err.message}`);
    process.exit(1);
  });
}

main();
