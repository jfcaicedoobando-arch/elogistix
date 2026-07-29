/**
 * Barrel raíz del feature `proformas` (piloto O4, auditoría 2026-07-29).
 * Misma política que `tesoreria/index.ts`: los deep imports externos están
 * bloqueados por `feature-barrel-surface.test.ts` (baseline en burn-down).
 */
export * from "./services";
export * from "./hooks";
export * from "./domain";
