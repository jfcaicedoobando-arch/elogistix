/**
 * Los 4 cargos de una opción de Pricing: tarifa + moneda + unidad cada uno.
 */
import { CARGOS_PRICING, MONEDAS_PRICING, type ClaveCargo, type OpcionPricingForm } from "@/features/crm/services/pricing/tiposPricing";
import { aNumero, CampoLista, CampoTexto } from "./CamposPricing";

interface Props {
  idBase: string;
  datos: OpcionPricingForm;
  set: (cambios: Partial<OpcionPricingForm>) => void;
  disabled?: boolean;
}

function llaves(c: ClaveCargo) {
  return { tarifa: `${c}_tarifa`, moneda: `${c}_moneda`, unidad: `${c}_unidad` } as const;
}

export function CargosPricingCampos({ idBase, datos, set, disabled }: Props) {
  const leer = (k: string) => (datos as Record<string, string | number | null | undefined>)[k];
  return (
    <div className="space-y-3">
      {CARGOS_PRICING.map(({ clave, etiqueta }) => {
        const k = llaves(clave);
        return (
          <div key={clave} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {clave === "otros" ? (
              <CampoTexto id={`${idBase}-otros-c`} label="Otros (especificar)" disabled={disabled}
                value={datos.otros_concepto} onChange={(v) => set({ otros_concepto: v || null })} />
            ) : (
              <p className="self-end pb-2 text-body-sm font-medium">{etiqueta}</p>
            )}
            <CampoTexto id={`${idBase}-${k.tarifa}`} label="Tarifa" type="number" disabled={disabled}
              value={leer(k.tarifa)} onChange={(v) => set({ [k.tarifa]: aNumero(v) })} />
            <CampoLista id={`${idBase}-${k.moneda}`} label="Moneda" disabled={disabled} opciones={MONEDAS_PRICING}
              value={leer(k.moneda) as string | null} onChange={(v) => set({ [k.moneda]: v })} />
            <CampoTexto id={`${idBase}-${k.unidad}`} label="Unidad" disabled={disabled}
              value={leer(k.unidad)} onChange={(v) => set({ [k.unidad]: v || null })} />
          </div>
        );
      })}
    </div>
  );
}
