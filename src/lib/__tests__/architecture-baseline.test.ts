/**
 * Baseline de violaciones arquitectónicas.
 *
 * Complementa `architecture.test.ts` (que sólo cubre lib/ y services/) con
 * un control NO-REGRESSION sobre `src/hooks/**` y `src/contexts/**`:
 * éstos no deberían importar `@/integrations/supabase/client` directamente
 * (Pages → Hooks → **Services** → Lib).
 *
 * Como hay deuda histórica, este test no falla por las violaciones
 * existentes — falla SÓLO si aparece una violación nueva o si una de las
 * conocidas cambia de archivo. Esto evita que la deuda crezca mientras se
 * planifica la migración (ver `mem://audit/pendings`).
 *
 * Cuando un archivo del baseline se limpie:
 *   1. Quitarlo de `BASELINE`.
 *   2. El test seguirá pasando.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRECT_CLIENT_IMPORT = /from\s+["']@\/integrations\/supabase\/client["']/;

const BASELINE: ReadonlySet<string> = new Set([
  // contexts/ — auth + organization (5)
  "src/contexts/AuthContext.tsx",
  "src/contexts/OrganizationContext.tsx",
  "src/contexts/auth/useAuthProfile.ts",
  "src/contexts/auth/useAuthSession.ts",
  "src/contexts/auth/useLoginAudit.ts",
  // hooks/admin (3)
  "src/hooks/admin/useAlertasSistema.ts",
  "src/hooks/admin/useAppLogs.ts",
  "src/hooks/admin/useAppLogsHealth.ts",
  // hooks/auditoria (1)
  "src/hooks/auditoria/revisiones/query.ts",
  // hooks/crm (17)
  "src/hooks/crm/automatizacionesEtapaActions.ts",
  "src/hooks/crm/leads/bulk.ts",
  "src/hooks/crm/leads/convertir.ts",
  "src/hooks/crm/leads/convertirHelpers.ts",
  "src/hooks/crm/leads/mutations.ts",
  "src/hooks/crm/leads/queries.ts",
  "src/hooks/crm/useActividades.ts",
  "src/hooks/crm/useActualizarActividadNotas.ts",
  "src/hooks/crm/useAutomatizacionesEtapa.ts",
  "src/hooks/crm/useCliente360.ts",
  "src/hooks/crm/useComentariosOportunidad.ts",
  "src/hooks/crm/useCrmDashboard.ts",
  "src/hooks/crm/useCrmNotificaciones.ts",
  "src/hooks/crm/useCrmSearch.ts",
  "src/hooks/crm/useEtapasPipeline.ts",
  "src/hooks/crm/useForecastReportes.ts",
  "src/hooks/crm/useNextBestActions.ts",
  "src/hooks/crm/useOportunidades.ts",
  "src/hooks/crm/usePlantillasMensaje.ts",
  "src/hooks/crm/useProximasActividades.ts",
  // hooks/embarque (3)
  "src/hooks/embarque/mutations/useUpdateEmbarque.ts",
  "src/hooks/embarque/useJsonCargoBolLookup.ts",
  "src/hooks/embarque/useJsonCargoTracking.ts",
  // hooks/portal (1)
  "src/hooks/portal/useNotificacionesCliente.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

function findCurrentViolators(roots: string[]): Set<string> {
  const violators = new Set<string>();
  for (const root of roots) {
    for (const f of walk(join(ROOT, root))) {
      const src = readFileSync(f, "utf8");
      if (DIRECT_CLIENT_IMPORT.test(src)) {
        violators.add(relative(ROOT, f).split("\\").join("/"));
      }
    }
  }
  return violators;
}

describe("Arquitectura — baseline de imports directos a supabase/client", () => {
  const current = findCurrentViolators(["src/hooks", "src/contexts"]);

  it("hooks/ y contexts/ no introducen NUEVOS imports directos al cliente Supabase", () => {
    const nuevos = [...current].filter((f) => !BASELINE.has(f)).sort();
    expect(
      nuevos,
      `Aparecieron nuevos archivos importando supabase/client. Mover la consulta a services/<dominio>:\n${nuevos.join(
        "\n",
      )}`,
    ).toEqual([]);
  });

  it("components/ y pages/ jamás importan supabase/client directamente", () => {
    const v = [...findCurrentViolators(["src/components", "src/pages"])].sort();
    expect(
      v,
      `components/ y pages/ deben ir vía hooks/ + services/. Violaciones:\n${v.join("\n")}`,
    ).toEqual([]);
  });

  it("entradas obsoletas del baseline deben removerse", () => {
    const stale = [...BASELINE].filter((f) => !current.has(f)).sort();
    expect(
      stale,
      `Estos archivos ya no violan la regla. Quítalos de BASELINE en este archivo:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
