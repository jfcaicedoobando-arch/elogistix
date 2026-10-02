/** Alta de un escalón de regla: criterio, de dónde sale el dato, condición y puntos. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import { useCrearRegla } from "@/features/crm/hooks/useScoringCrm";
import { ETIQUETA_FUENTE, validarRegla, type FuenteRegla } from "@/features/crm/services/scoring/reglasScoringCrm";
import { armarRegla, FORMA_VACIA, type FormaRegla } from "@/features/crm/services/scoring/describirRegla";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import { CampoLista, CampoTexto } from "@/features/crm/components/pricing/CamposPricing";

const FUENTES: FuenteRegla[] = ["propiedad", "monto_usd", "etapa", "contacto_ligado", "pricing_respondida"];

export function NuevaReglaScoringForm({ objeto, orden }: { objeto: ObjetoPuntaje; orden: number }) {
  const crear = useCrearRegla();
  const { data: props = [] } = usePropiedadesCrm(objeto);
  const [f, setF] = useState<FormaRegla>(FORMA_VACIA);
  const set = (cambio: Partial<FormaRegla>) => setF((x) => ({ ...x, ...cambio }));
  const prop = f.fuente === "propiedad" ? props.find((p) => p.id === f.propId) : undefined;
  const conOpciones = prop?.tipo === "seleccion" || prop?.tipo === "multiseleccion";
  const conRango = f.fuente === "monto_usd" || prop?.tipo === "numero";
  const regla = armarRegla(f, { objeto, orden, conOpciones, conRango });
  const error = validarRegla(regla);
  const fuentes = (objeto === "oportunidad" ? FUENTES : FUENTES.slice(0, 1)).map((x) => ({ value: x, label: ETIQUETA_FUENTE[x] }));
  const id = (c: string) => `regla-${objeto}-${c}`;

  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
      <CampoTexto id={id("criterio")} label="Criterio" value={f.criterio} onChange={(v) => set({ criterio: v })} />
      <CampoLista id={id("fuente")} label="Dato" value={f.fuente} opciones={fuentes}
        onChange={(v) => set({ fuente: (v ?? "propiedad") as FuenteRegla })} />
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
      <CampoTexto id={id("puntos")} label="Puntos" type="number" value={f.puntos} onChange={(v) => set({ puntos: v })} />
      <div className="flex items-end gap-2 md:col-span-4">
        <Button disabled={!!error || crear.isPending} onClick={() => crear.mutate(regla, { onSuccess: () => set({ criterio: "" }) })}>
          Agregar regla
        </Button>
        {error && f.criterio && <span className="text-body-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
