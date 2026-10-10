import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { INCOTERMS } from "@/constants/wizardConstants";
import { Constants, type Database } from "@/integrations/supabase/types";
import { incotermSchema } from "@/features/embarques/domain/mappers/embarquePayloadSchemas";
import { buildCotizacionDefaultValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import AvisoIncotermCIF from "@/features/cotizacion/components/wizard/AvisoIncotermCIF";
import { validarIncotermRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";

const nuevos = ["FAS", "DPU"] as const satisfies readonly Database["public"]["Enums"]["incoterm"][];
describe("contrato exacto FAS/DPU", () => {
  it.each(nuevos)("%s coincide en catálogos, validador, transferencia y restauración", (incoterm) => {
    expect(INCOTERMS).toContain(incoterm);
    expect(Constants.public.Enums.incoterm).toContain(incoterm);
    expect(incotermSchema.parse(incoterm)).toBe(incoterm);
    expect(validarIncotermRespuestaPricing({ incoterm, cantidad: 1, servicio: "Marítimo", tipo_carga: "40 HC" })).toBe(incoterm);
    expect(buildCotizacionDefaultValues(makeCotizacionRow({ incoterm })).incoterm).toBe(incoterm);
  });
  it("no acepta valores ajenos ni sustituye DPU por DAT", () => {
    expect(incotermSchema.safeParse("UNKNOWN").success).toBe(false);
    expect(incotermSchema.parse("DPU")).not.toBe("DAT");
    expect(incotermSchema.parse("FAS")).not.toBe("FOB");
  });
  it("DPU comunica sólo flete en origen", () => {
    const { container } = render(<AvisoIncotermCIF incoterm="DPU" />);
    expect(container.textContent).toContain("Embarque DPU: flete contratado en origen");
    expect(container.textContent).not.toContain("seguro");
  });
  it.each(["CIF", "CIP"])("%s conserva flete y seguro", (incoterm) => {
    const { container } = render(<AvisoIncotermCIF incoterm={incoterm} />);
    expect(container.textContent).toContain(`Embarque ${incoterm}: flete y seguro contratados en origen`);
    expect(container.textContent).toContain("seguro de carga");
  });
});
