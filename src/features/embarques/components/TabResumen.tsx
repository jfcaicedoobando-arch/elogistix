import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toTitleCase } from "@/lib/formatters";
import { useEmbarquesRelacionados } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { EstadoProgresoCard } from "./tabResumen/EstadoProgresoCard";
import { DatosGeneralesCard, RutaTransporteCard } from "./tabResumen/ResumenCards";
import { EmbarquesRelacionadosCard } from "./tabResumen/EmbarquesRelacionadosCard";
import { ComisionEmbarqueCard } from "./tabResumen/ComisionEmbarqueCard";
import { OrigenCostosSection } from "./OrigenCostosSection";
import { SeccionContenedoresReadonly } from "./contenedores/SeccionContenedoresReadonly";

interface Props {
  embarque: EmbarqueRow;
}

export function TabResumen({ embarque }: Props) {
  const { data: relacionados = [] } = useEmbarquesRelacionados(embarque.id, embarque.bl_master);
  const { registerRef } = useFocusSection();

  return (
    <div className="space-y-6">
      <EstadoProgresoCard
        embarque={{
          modo: embarque.modo,
          tipo: embarque.tipo,
          estado: embarque.estado,
          etd: embarque.etd,
          eta: embarque.eta,
          fecha_creacion: embarque.fecha_creacion,
          fecha_llegada_real: embarque.fecha_llegada_real,
          cotizacion_id: embarque.cotizacion_id,
          updated_at: embarque.updated_at,
        }}
        arribado={Boolean(embarque.fecha_llegada_real)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <DatosGeneralesCard embarque={embarque} />
        <RutaTransporteCard embarque={embarque} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle >Partes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <ParteCampo label="Shipper" valor={embarque.shipper} embarqueId={embarque.id} />
          <ParteCampo label="Consignatario" valor={embarque.consignatario} embarqueId={embarque.id} />
        </CardContent>
      </Card>

      <ComisionEmbarqueCard embarqueId={embarque.id} />

      {embarque.modo === "Marítimo" && (
        <div ref={registerRef("contenedores")} data-focus="contenedores">
          <SeccionContenedoresReadonly embarqueId={embarque.id} />
        </div>
      )}

      <OrigenCostosSection
        tarifaIdOriginal={(embarque as { tarifa_id_original?: string | null }).tarifa_id_original}
        tarifaIdAplicada={(embarque as { tarifa_id_aplicada?: string | null }).tarifa_id_aplicada}
        decision={(embarque as { tarifa_decision?: string | null }).tarifa_decision}
        deltaJsonb={(embarque as { tarifa_delta_jsonb?: unknown }).tarifa_delta_jsonb}
        revalidadaEn={(embarque as { tarifa_revalidada_en?: string | null }).tarifa_revalidada_en}
      />

      {relacionados.length > 1 && (
        <EmbarquesRelacionadosCard
          embarqueId={embarque.id}
          blMaster={embarque.bl_master}
          relacionados={relacionados}
        />
      )}
    </div>
  );
}

/** Campo de "Partes" con estado vacío accionable hacia la edición del embarque. */
function ParteCampo({ label, valor, embarqueId }: { label: string; valor?: string | null; embarqueId: string }) {
  const texto = toTitleCase(valor ?? "");
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {texto ? (
        <div className="text-foreground">{texto}</div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground italic">Sin capturar</span>
          <Link
            to={`/embarques/${embarqueId}/editar`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Capturar
          </Link>
        </div>
      )}
    </div>
  );
}
