/**
 * FIX 6 (P3) — La notificación al portal usa `humanizarEnum` para el tipo de
 * operación y arma folio + ruta. Verifica que nunca llegue un slug crudo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const selectRow = {
  id: "cot-1",
  folio: "COT-0001",
  cliente_id: "cli-1",
  organization_id: "org-1",
  origen: "Shanghái",
  destino: "Manzanillo",
  tipo: "importacion",
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabla: string) => {
      if (tabla === "cotizaciones") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: selectRow, error: null }) }),
          }),
        };
      }
      return { insert: insertMock };
    },
  },
}));

const { notificarClienteCotizacionEnviada } = await import(
  "@/features/cotizacion/services/mutations/notificarClienteEnviada"
);

describe("notificarClienteCotizacionEnviada", () => {
  beforeEach(() => insertMock.mockClear());

  it("inserta la notificación con folio, ruta y tipo en es-MX", async () => {
    const ok = await notificarClienteCotizacionEnviada("cot-1");
    expect(ok).toBe(true);
    const payload = insertMock.mock.calls[0][0] as Record<string, string>;
    expect(payload.titulo).toContain("COT-0001");
    expect(payload.mensaje).toContain("Shanghái → Manzanillo");
    expect(payload.mensaje).toContain("Importación");
    expect(payload.mensaje).not.toContain("importacion");
    expect(payload.url).toBe("/portal/cotizaciones/cot-1");
  });
});
