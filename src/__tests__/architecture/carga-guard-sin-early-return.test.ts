/**
 * UI-4 · un solo guard de carga/error.
 *
 * Cuando una pantalla hace `return <LoadingState />` (o un esqueleto) ANTES de
 * pintar su encabezado, el usuario pierde el título, las pestañas y los
 * accesos durante toda la carga: la pantalla parece otra. El patrón correcto
 * es pintar el shell/encabezado siempre y dejar que el estado de carga o error
 * ocupe sólo el cuerpo (como en `ProfitEstadoResultados`), usando `CargaGuard`
 * cuando además se quiera la red de seguridad por timeout.
 *
 * La allowlist recoge los casos donde no hay encabezado que preservar porque
 * depende del propio dato que se está cargando (detalles por id, vistas de
 * desarrollo) o donde el retorno vive en un helper de render interno.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const ESTADOS = [
  "LoadingState",
  "DashboardSkeleton",
  "ListSkeleton",
  "TableSkeleton",
  "CardSkeleton",
  "ErrorState",
];

const PATRON = new RegExp(`return\\s*\\(?\\s*<(${ESTADOS.join("|")})\\b`, "g");

const ALLOWLIST = new Set([
  // El encabezado depende del registro que se está cargando: sin dato no hay título.
  "src/features/crm/routes/OportunidadDetalle.tsx",
  "src/features/crm/routes/LeadDetalle.tsx",
  "src/features/portal/routes/PortalCotizacionDetalle.tsx",
  "src/features/proformas/routes/PortalProforma.tsx",
  // Pantallas de cálculo/diagnóstico sin encabezado propio.
  "src/features/crm/routes/Higiene.tsx",
  "src/features/crm/routes/Analitica.tsx",
  "src/features/dev/routes/PdfPreviewCotizacion.tsx",
  // El retorno vive en un helper de render interno, no en el cuerpo de la ruta.
  "src/features/dashboard/routes/Bitacora.tsx",
]);

describe("UI-4 · sin early-return de estados de carga en rutas", () => {
  it("las rutas pintan su encabezado antes del estado de carga o error", () => {
    const archivos = globSync("src/**/routes/*.tsx", {
      ignore: ["**/__tests__/**", "**/*.test.tsx"],
    });
    const infractores: string[] = [];
    for (const archivo of archivos) {
      if (ALLOWLIST.has(archivo)) continue;
      const codigo = readFileSync(archivo, "utf8");
      if (PATRON.test(codigo)) infractores.push(archivo);
      PATRON.lastIndex = 0;
    }
    expect(
      infractores,
      "Estas rutas devuelven un estado de carga/error antes de su encabezado. " +
        "Pinta el shell (PageHeader / PortalPageShell) y mete el estado en el cuerpo, " +
        "o justifica el caso en la allowlist de esta prueba:\n" +
        infractores.join("\n"),
    ).toEqual([]);
  });

  it("la allowlist no acumula archivos inexistentes", () => {
    const faltantes = [...ALLOWLIST].filter((ruta) => globSync(ruta).length === 0);
    expect(faltantes, `Rutas en la allowlist que ya no existen: ${faltantes.join(", ")}`).toEqual([]);
  });
});
