import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * B5 — el detalle de cotización fijaba el título del landing público.
 * Convención MR-UI-01: se verifica sobre el fuente (la ruta es pesada de montar).
 */
const pagina = readFileSync("src/features/cotizacion/routes/CotizacionDetalle.tsx", "utf8");

describe("B5: título del documento en CotizacionDetalle", () => {
  it("usa el hook estándar de título, incondicionalmente", () => {
    expect(pagina).toContain('import { useDocumentTitle } from "@/hooks/shared"');
    expect(pagina).toContain(
      'useDocumentTitle(cotizacion?.folio ? `Cotización ${cotizacion.folio}` : "Cotización")',
    );
  });

  it("se fija antes de cualquier retorno temprano de la pantalla", () => {
    const idxTitulo = pagina.indexOf("useDocumentTitle(cotizacion?.folio");
    const idxPrimerReturn = pagina.indexOf("  if (!isLoading && !error && !cotizacion)");
    expect(idxTitulo).toBeGreaterThan(0);
    expect(idxTitulo).toBeLessThan(idxPrimerReturn);
  });
});
