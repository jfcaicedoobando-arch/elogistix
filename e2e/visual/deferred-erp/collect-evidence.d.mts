import type { ValidationExecutor } from "./validation-checks.mjs";
export function collectEvidence(options?: { root?: string; execute?: ValidationExecutor }): Promise<Record<string, unknown>>;
