import { describe, expect, it } from "vitest";
import { formatearPrefijoReferencias, hasAlgunaReferencia, resolverReferenciasPreview } from "../domain/referenciasFacturaPreview";
import { buildDescripcionPrefix, hasReferencias } from "../../../../supabase/functions/_shared/referenciasEmbarque";

describe("preview143 · contrato descriptivo de Edge", () => {
  it.each([
    null,
    { expediente: null, bl_master: null, bl_house: null },
    { expediente: " ", bl_master: "\t", bl_house: "" },
    { expediente: " E22 ", bl_master: " M22 ", bl_house: " H22 " },
    { expediente: null, bl_master: "BL-M", bl_house: null },
    { expediente: null, bl_master: null, bl_house: "BL-H" },
    { expediente: "E21", bl_master: null, bl_house: null },
  ])("sólo muestra expediente + BL Master + BL House como el backend: %j", (ref) => {
    expect(formatearPrefijoReferencias(ref)).toBe(buildDescripcionPrefix(ref));
    expect(hasAlgunaReferencia(ref)).toBe(hasReferencias(ref));
  });

  it("no añade Carta Porte ni reemplaza valores vacíos verificados con snapshots", () => {
    const origen = { id: "e1", expediente: "", bl_master: "", bl_house: "", carta_porte: "NO-INCLUIR" };
    const result = resolverReferenciasPreview(
      { embarque_id: "e1", expediente: "HEADER", referencia_bl: "HEADER-BL" },
      [{ id: "c1", descripcion: "Flete", embarque_id: null }], [origen],
    );
    expect(formatearPrefijoReferencias(result.conceptos[0].referencias)).toBe("");
    expect(result.conceptos[0].estado).toBe("verificado");
  });
});
