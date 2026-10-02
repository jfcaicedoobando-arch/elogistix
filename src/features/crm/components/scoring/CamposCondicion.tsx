/** Campos de condición de una regla según el dato elegido (propiedad, opción, etapa o rango). */
import { CampoLista, CampoTexto } from "@/features/crm/components/pricing/CamposPricing";
import type { PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { FormaRegla } from "@/features/crm/services/scoring/describirRegla";

interface Props {
  f: FormaRegla; set: (c: Partial<FormaRegla>) => void; props: PropiedadCrm[]; prop: PropiedadCrm | undefined;
  conOpciones: boolean; conRango: boolean; id: (c: string) => string;
}

export function CamposCondicion({ f, set, props, prop, conOpciones, conRango, id }: Props) {
  return (
    <>
      {f.fuente === "propiedad" && (
        <CampoLista id={id("prop")} label="Propiedad" value={f.propId === "sin" ? null : f.propId}
          opciones={props.filter((p) => !p.archivada).map((p) => ({ value: p.id, label: p.etiqueta }))}
          onChange={(v) => set({ propId: v ?? "sin", opcionId: "sin" })} />
      )}
      {conOpciones && prop && (
        <CampoLista id={id("opcion")} label="Opción (— = cualquiera capturada)" value={f.opcionId === "sin" ? null : f.opcionId}
          opciones={prop.opciones.filter((o) => !o.archivada).map((o) => ({ value: o.id, label: o.etiqueta }))}
          onChange={(v) => set({ opcionId: v ?? "sin" })} />
      )}
      {f.fuente === "etapa" && (
        <CampoTexto id={id("etapa")} label="Nombre de la etapa" value={f.etapa} onChange={(v) => set({ etapa: v })} />
      )}
      {conRango && <CampoTexto id={id("min")} label="Desde (incluye)" type="number" value={f.min} onChange={(v) => set({ min: v })} />}
      {conRango && <CampoTexto id={id("max")} label="Hasta (sin incluir)" type="number" value={f.max} onChange={(v) => set({ max: v })} />}
    </>
  );
}
