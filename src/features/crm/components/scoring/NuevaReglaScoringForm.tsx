/** Alta de un escalón de regla: criterio, de dónde sale el dato, condición y puntos. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import { useCrearRegla } from "@/features/crm/hooks/useScoringCrm";
import { ETIQUETA_FUENTE, validarRegla, type FuenteRegla } from "@/features/crm/services/scoring/reglasScoringCrm";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import { aNumero } from "@/features/crm/services/pricing/tiposPricing";

const FUENTES_OPORTUNIDAD: FuenteRegla[] = ["propiedad", "monto_usd", "etapa", "contacto_ligado", "pricing_respondida"];

export function NuevaReglaScoringForm({ objeto, orden }: { objeto: ObjetoPuntaje; orden: number }) {
  const crear = useCrearRegla();
  const { data: props = [] } = usePropiedadesCrm(objeto);
  const [criterio, setCriterio] = useState("");
  const [fuente, setFuente] = useState<FuenteRegla>("propiedad");
  const [propId, setPropId] = useState("sin");
  const [opcionId, setOpcionId] = useState("sin");
  const [etapa, setEtapa] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [puntos, setPuntos] = useState("10");
  const prop = props.find((p) => p.id === propId);
  const conOpciones = prop && (prop.tipo === "seleccion" || prop.tipo === "multiseleccion");
  const conRango = fuente === "monto_usd" || prop?.tipo === "numero";
  const regla = {
    objeto, criterio, fuente, orden, activa: true, puntos: Number(puntos),
    propiedad_id: fuente === "propiedad" && propId !== "sin" ? propId : null,
    opcion_id: conOpciones && opcionId !== "sin" ? opcionId : null,
    valor_texto: fuente === "etapa" ? etapa : null,
    min: conRango ? aNumero(min) : null, max: conRango ? aNumero(max) : null,
  };
  const error = validarRegla(regla);
  const fuentes = objeto === "oportunidad" ? FUENTES_OPORTUNIDAD : (["propiedad"] as FuenteRegla[]);

  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
      <div className="space-y-1"><Label>Criterio</Label>
        <Input value={criterio} onChange={(e) => setCriterio(e.target.value)} placeholder="Ej. Volumen de importación" /></div>
      <div className="space-y-1"><Label>Dato</Label>
        <Select value={fuente} onValueChange={(v) => setFuente(v as FuenteRegla)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{fuentes.map((f) => <SelectItem key={f} value={f}>{ETIQUETA_FUENTE[f]}</SelectItem>)}</SelectContent>
        </Select></div>
      {fuente === "propiedad" && (
        <div className="space-y-1"><Label>Propiedad</Label>
          <Select value={propId} onValueChange={(v) => { setPropId(v); setOpcionId("sin"); }}>
            <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sin">Elige…</SelectItem>
              {props.filter((p) => !p.archivada).map((p) => <SelectItem key={p.id} value={p.id}>{p.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select></div>
      )}
      {conOpciones && (
        <div className="space-y-1"><Label>Opción</Label>
          <Select value={opcionId} onValueChange={setOpcionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sin">Cualquiera capturada</SelectItem>
              {prop.opciones.filter((o) => !o.archivada).map((o) => <SelectItem key={o.id} value={o.id}>{o.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select></div>
      )}
      {fuente === "etapa" && (
        <div className="space-y-1"><Label>Nombre de la etapa</Label>
          <Input value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="Ej. Negociación" /></div>
      )}
      {conRango && (
        <>
          <div className="space-y-1"><Label>Desde (incluye)</Label><Input type="number" value={min} onChange={(e) => setMin(e.target.value)} /></div>
          <div className="space-y-1"><Label>Hasta (sin incluir)</Label><Input type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
        </>
      )}
      <div className="space-y-1"><Label>Puntos</Label>
        <Input type="number" min={0} max={100} value={puntos} onChange={(e) => setPuntos(e.target.value)} /></div>
      <div className="flex items-end gap-2 md:col-span-4">
        <Button disabled={!!error || crear.isPending} onClick={() => crear.mutate(regla, { onSuccess: () => setCriterio("") })}>
          Agregar regla
        </Button>
        {error && criterio && <span className="text-body-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
