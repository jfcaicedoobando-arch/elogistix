import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmbarquesRelacionados } from "@/features/embarques/hooks";
import { useEmbarqueInterno } from "@/features/embarques/hooks/useEmbarqueInterno";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { EstadoProgresoCard } from "./tabResumen/EstadoProgresoCard";
import { DatosGeneralesCard, RutaTransporteCard } from "./tabResumen/ResumenCards";
import { EmbarquesRelacionadosCard } from "./tabResumen/EmbarquesRelacionadosCard";
import { ComisionEmbarqueCard } from "./tabResumen/ComisionEmbarqueCard";
import { OrigenCostosSection } from "./OrigenCostosSection";
import { SeccionContenedoresReadonly } from "./contenedores/SeccionContenedoresReadonly";
import { CargaConsolidadaCard } from "./contenedores/CargaConsolidadaCard";
import { OrigenLclManualCard } from "./OrigenLclManualCard";
import { Button } from "@/components/ui/button";

interface Props {
  embarque: EmbarqueRow;
}

export function TabResumen({ embarque }: Props) {
  const { data: relacionados = [] } = useEmbarquesRelacionados(embarque.id, embarque.bl_master);
  const { registerRef } = useFocusSection();
  // `tarifa_delta_jsonb` no es legible en la tabla `embarques`: viene de la
  // vista interna (staff). Sin esto la sección "Origen de costos" quedaba vacía.
  const { data: interno } = useEmbarqueInterno(embarque.id);

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
        <CardHeader className="pb-3"><CardTitle>Partes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-body">
          <ParteCampo label="Shipper" valor={embarque.shipper} embarqueId={embarque.id} />
          <ParteCampo label="Consignatario" valor={embarque.consignatario} embarqueId={embarque.id} />
        </CardContent>
      </Card>

      <ComisionEmbarqueCard embarqueId={embarque.id} />

      {embarque.modo === "Marítimo" && (
        <div ref={registerRef("contenedores")} data-focus="contenedores">
          {embarque.tipo_servicio === "LCL" ? (
            <CargaConsolidadaCard
              piezas={embarque.piezas}
              pesoKg={embarque.peso_kg}
              volumenM3={embarque.volumen_m3}
            />
          ) : (
            <SeccionContenedoresReadonly embarqueId={embarque.id} />
          )}
        </div>
      )}

      {embarque.tipo_servicio === "LCL" && embarque.cotizacion_id
        && !(embarque as { tarifa_id_original?: string | null }).tarifa_id_original && (
        <OrigenLclManualCard cotizacionId={embarque.cotizacion_id} />
      )}

      <OrigenCostosSection
        tarifaIdOriginal={(embarque as { tarifa_id_original?: string | null }).tarifa_id_original}
        tarifaIdAplicada={(embarque as { tarifa_id_aplicada?: string | null }).tarifa_id_aplicada}
        decision={(embarque as { tarifa_decision?: string | null }).tarifa_decision}
        deltaJsonb={interno?.tarifa_delta_jsonb}
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
  // Razón social / shipper: literal capturado (no se reescriben siglas).
  const texto = (valor ?? "").trim();
  return (
    <div className="space-y-1">
      <div className="text-body-sm uppercase tracking-wide text-muted-foreground">{label}</div>
      {texto ? (
        <div className="text-foreground">{texto}</div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground italic">Sin capturar</span>
          <Button variant="link" size="sm" asChild className="h-auto p-0 text-body-sm font-medium">
            <Link to={`/embarques/${embarqueId}/editar`} className="inline-flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Capturar
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
