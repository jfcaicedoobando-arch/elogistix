/**
 * Captura de una opción de tarifa (Pricing). Puede llenarse desde el catálogo
 * de Costeo o a mano. Sólo editable mientras la solicitud está enviada.
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NavieraSelect } from "@/features/catalogos";
import { useEliminarOpcion, useGuardarOpcion, useTarifasPricing } from "@/features/crm/hooks/usePricingCrm";
import {
  OPCION_VACIA, type OpcionPricingForm, type OpcionPricingRow,
} from "@/features/crm/services/pricing/tiposPricing";
import {
  etiquetaTarifa, opcionDesdeTarifa,
} from "@/features/crm/services/pricing/tarifasParaPricing";
import { CampoLista, CampoSiNo, CampoTexto } from "./CamposPricing";
import { CargosPricingCampos } from "./CargosPricingCampos";

interface Props {
  solicitudId: string;
  organizationId: string;
  orden: number;
  opcion?: OpcionPricingRow;
  editable: boolean;
  onListo?: () => void;
}

function aForm(o?: OpcionPricingRow): OpcionPricingForm {
  if (!o) return OPCION_VACIA;
  const { id: _i, organization_id: _o, solicitud_id: _s, created_at: _c, updated_at: _u, created_by: _b, orden: _r, ...resto } = o;
  return resto;
}

export function OpcionPricingEditor({ solicitudId, organizationId, orden, opcion, editable, onListo }: Props) {
  const [datos, setDatos] = useState<OpcionPricingForm>(() => aForm(opcion));
  const guardar = useGuardarOpcion();
  const eliminar = useEliminarOpcion();
  const tarifas = useTarifasPricing(editable);
  const set = (c: Partial<OpcionPricingForm>) => setDatos((p) => ({ ...p, ...c }));
  const idBase = `op-${opcion?.id ?? "nueva"}`;
  const off = !editable || guardar.isPending;

  const onGuardar = () =>
    guardar.mutate({ id: opcion?.id, solicitudId, organizationId, orden, datos }, { onSuccess: () => onListo?.() });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-body">Opción {orden}</CardTitle>
        {editable && opcion && (
          <Button type="button" size="icon" variant="ghost" aria-label="Quitar opción"
            disabled={eliminar.isPending} onClick={() => eliminar.mutate({ id: opcion.id, solicitudId })}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editable && (
          <CampoLista id={`${idBase}-tarifa`} label="Copiar de tarifa del catálogo (opcional)"
            value={datos.tarifa_id ?? null}
            opciones={(tarifas.data ?? []).map((t) => ({ value: t.id, label: etiquetaTarifa(t) }))}
            onChange={(id) => {
              const t = tarifas.data?.find((x) => x.id === id);
              setDatos((p) => (t ? opcionDesdeTarifa(p, t) : { ...p, tarifa_id: null }));
            }} />
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CampoTexto id={`${idBase}-agente`} label="Agente" disabled={off} value={datos.agente}
            onChange={(v) => set({ agente: v || null })} />
          <div className="space-y-1.5">
            <Label>Naviera</Label>
            <NavieraSelect value={datos.naviera_id ?? null} disabled={off} onSelect={(n) => set({ naviera_id: n.id })} />
          </div>
          <CampoSiNo id={`${idBase}-carta`} label="Carta garantía" disabled={off} value={datos.carta_garantia}
            onChange={(v) => set({ carta_garantia: v })} />
          <CampoTexto id={`${idBase}-transito`} label="Tiempo de tránsito" disabled={off} value={datos.transito}
            onChange={(v) => set({ transito: v || null })} />
          <CampoTexto id={`${idBase}-ruta`} label="Ruta" disabled={off} value={datos.ruta}
            onChange={(v) => set({ ruta: v || null })} />
        </div>
        <CargosPricingCampos idBase={idBase} datos={datos} set={set} disabled={off} />
        {editable && (
          <div className="flex justify-end">
            <Button type="button" onClick={onGuardar} disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar opción"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
