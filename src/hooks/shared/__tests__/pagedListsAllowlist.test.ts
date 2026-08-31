/**
 * Guardrail arquitectónico — Filtros globales (plan `.lovable/plan.md`).
 *
 * Objetivo: garantizar que las tablas listadas como YA migradas siguen usando
 * el primitivo unificado (`useServerPagedList` o `useClientPagedList`) y que
 * pasan `pagination` al `<DataTable>`. Si alguien revierte una ruta migrada
 * a filtros locales, este test falla y obliga a re-migrar o actualizar la
 * allowlist explícitamente.
 *
 * NOTA: la lista se extiende ola por ola (Ola 2 CRM, Ola 3 Portales, etc.).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Rutas que ya viven en el patrón unificado (Olas 1-2). */
const MIGRATED_ROUTES = [
  // Ola 1 — Bandejas financieras
  "src/features/bandejas/routes/Cartera.tsx",
  "src/features/bandejas/routes/CxpPorPagar.tsx",
  "src/features/cxp/routes/CxpAging.tsx",
  "src/features/comisiones/routes/Comisiones.tsx",
  // Ola 2 — CRM
  "src/features/crm/routes/Leads.tsx",
  "src/features/crm/routes/Actividades.tsx",
  // YG-03 — Cotizaciones (el primitivo vive en useCotizacionesPageController)
  "src/features/cotizacion/routes/Cotizaciones.tsx",
] as const;

describe("Filtros globales — allowlist de rutas migradas", () => {
  it.each(MIGRATED_ROUTES)(
    "%s usa el primitivo paginado unificado",
    (relPath) => {
      const src = readFileSync(resolve(process.cwd(), relPath), "utf8");
      const usesPrimitive = /useServerPagedList|useClientPagedList/.test(src);
      expect(usesPrimitive, `${relPath} debe importar useServerPagedList o useClientPagedList`).toBe(true);
    },
  );

  it.each(MIGRATED_ROUTES)(
    "%s pasa la prop `pagination` al DataTable",
    (relPath) => {
      const src = readFileSync(resolve(process.cwd(), relPath), "utf8");
      // Aceptamos `pagination={...}` o `pagination={pagination}` para cubrir
      // ambas formas idiomáticas.
      const usesPagination = /pagination=\{/.test(src);
      expect(usesPagination, `${relPath} debe pasar prop pagination`).toBe(true);
    },
  );
});
