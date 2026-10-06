/**
 * Respuesta de una solicitud de pricing: tarifas del catálogo ligadas a ella.
 * Pricing agrega una tarifa por opción con el mismo formulario del catálogo.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TarifaForm } from "@/features/costeo";
import type { TarifaRespuestaRow } from "@/features/crm/services/pricing/tarifasRespuesta";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";

interface Props {
  solicitudId: string;
  editable: boolean;
  hayOpcionesViejas: boolean;
  tarifas: TarifaRespuestaRow[];
  isLoading: boolean;
  isError: boolean;
  onSaved: () => void;
}

const carta = (v: boolean | null) => (v === true ? "Sí" : v === false ? "No" : "—");
const moneda = (n: number, m: string) =>
  formatCurrency(Number(n) || 0, m || "USD");

function FilaTarifa({ t, n }: { t: TarifaRespuestaRow; n: number }) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-4 text-body-sm md:grid-cols-4">
        <div className="col-span-2 font-medium md:col-span-4">Opción {n}</div>
        <div><span className="text-muted-foreground">Agente: </span>{t.agente?.nombre ?? "—"}</div>
        <div><span className="text-muted-foreground">Carrier: </span>{t.naviera?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Ruta: </span>{t.ruta?.origen?.name ?? "—"} → {t.ruta?.destino?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Contenedor: </span>{t.tipo?.code ?? "—"}</div>
        <div><span className="text-muted-foreground">Flete: </span>{moneda(t.flete_base, t.moneda)} {t.unidad_flete ?? ""}</div>
        <div><span className="text-muted-foreground">Tránsito: </span>{t.transit_time_dias != null ? `${t.transit_time_dias} días` : "—"}</div>
        <div><span className="text-muted-foreground">Carta garantía: </span>{carta(t.carta_garantia)}</div>
        <div><span className="text-muted-foreground">Vigente hasta: </span>{t.vigente_hasta ? formatDate(t.vigente_hasta) : "—"}</div>
      </CardContent>
    </Card>
  );
}

export function TarifasRespuestaPricing({ solicitudId, editable, hayOpcionesViejas, tarifas, isLoading, isError, onSaved }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-3">
      {tarifas.map((t, i) => <FilaTarifa key={t.id} t={t} n={i + 1} />)}
      {isError && <p className="text-body-sm text-destructive">No se pudieron cargar las tarifas de respuesta.</p>}
      {tarifas.length === 0 && !hayOpcionesViejas && !editable && !isLoading && !isError && (
        <p className="text-body-sm text-muted-foreground">Pricing aún no agrega tarifas.</p>
      )}
      {editable && (
        <Button variant="outline" onClick={() => setAbierto(true)}>
          <Plus className="mr-1 size-4" /> Agregar tarifa
        </Button>
      )}
      {abierto && (
        <TarifaForm open={abierto} onOpenChange={setAbierto} onSaved={onSaved}
          initial={{ solicitud_pricing_id: solicitudId, carta_garantia: null, unidad_flete: null }} />
      )}
    </div>
  );
}
