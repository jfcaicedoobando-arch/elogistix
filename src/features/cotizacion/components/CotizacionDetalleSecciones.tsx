import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { formatDate } from "@/lib/formatters";
import { RecotizarModal } from "@/features/cotizacion/components/versionado/RecotizarModal";
import { CrearEmbarqueConRevalidacion } from "@/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion";
import { accionesCotizacionPermitidas } from "@/features/cotizacion/domain/cotizacion";
import type { AppRole } from "@/types/appRole";




interface EmbarqueVinculado {
  id: string;
  expediente: string | null;
  estado: string;
  created_at: string;
}

interface Props {
  embarques: EmbarqueVinculado[];
  cotizacionEstado: string;
}

export function CotizacionDetalleEmbarques({ embarques, cotizacionEstado }: Props) {
  const navigate = useNavigate();

  // Mostrar la tarjeta cuando hay embarques vinculados, o cuando la cotización
  // ya está "En operación" / "Cerrada" para indicar que debería haberlos.
  const estadoSugiereEmbarque = cotizacionEstado === "En operación" || cotizacionEstado === "Cerrada";
  if (embarques.length === 0 && !estadoSugiereEmbarque) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Embarques Generados</CardTitle></CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta cotización aparece como <strong>{cotizacionEstado}</strong>, pero no hay embarques vinculados.
            Verifica con tu administrador o vuelve a generar el embarque desde el botón <em>Crear embarque</em>.
          </p>
        ) : (
          <div className="space-y-2">
            {embarques.map((emb) => (
              <div
                key={emb.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/embarques/${emb.id}`)}
              >
                <span className="font-medium text-primary">{emb.expediente}</span>
                <div className="flex items-center gap-3">
                  <Badge className={getEstadoColor(emb.estado)}>{emb.estado}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(emb.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AccionesProps {
  estado: string;
  esProspecto: boolean;
  numContenedores: number;
  cotizacionId: string;
  version?: number;
  tieneEmbarquesVinculados?: boolean;
  onCambiarEstado: (e: "Enviada" | "Aceptada" | "Rechazada") => void;
  onAbrirConvertir: () => void;
  total: number;
  rol: AppRole | null | undefined;
}


function AccionesBorrador({ cotizacionId, onCambiarEstado, puedeEnviar }: { cotizacionId: string; onCambiarEstado: AccionesProps["onCambiarEstado"]; puedeEnviar: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate(`/cotizaciones/${cotizacionId}/editar`)}>Editar</Button>
      {puedeEnviar && (
        <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Enviada")}>Marcar como Enviada</Button>
      )}
    </>
  );
}

function AccionesBorradorOEnviada({ onCambiarEstado, puedeAceptarRechazar }: { onCambiarEstado: AccionesProps["onCambiarEstado"]; puedeAceptarRechazar: boolean }) {
  if (!puedeAceptarRechazar) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Rechazada")}>Rechazar</Button>
      <Button size="sm" onClick={() => onCambiarEstado("Aceptada")}>Aceptar</Button>
    </>
  );
}

function AccionCrearEmbarque({ cotizacionId, numContenedores }: { cotizacionId: string; numContenedores: number }) {
  return (
    <CrearEmbarqueConRevalidacion
      cotizacionId={cotizacionId}
      numContenedores={numContenedores}
    />
  );
}

export function CotizacionDetalleAcciones({
  estado, esProspecto, numContenedores, cotizacionId, version,
  tieneEmbarquesVinculados = false,
  onCambiarEstado, onAbrirConvertir, total, rol,
}: AccionesProps) {
  const [recotizarOpen, setRecotizarOpen] = useState(false);
  const acciones = accionesCotizacionPermitidas(estado, total, rol);
  const esBorradorOEnviada = estado === "Borrador" || estado === "Enviada";
  const esAceptada = estado === "Aceptada";
  const mostrarCrearEmbarque = esAceptada && !esProspecto && !tieneEmbarquesVinculados;
  // Fase J v13.301.81: sólo se puede re-cotizar si aún no hay embarque generado.
  // Con embarque vivo, el flujo correcto es crear una nueva cotización.
  const mostrarRecotizar = esAceptada && !tieneEmbarquesVinculados;

  return (
    <div className="flex flex-wrap gap-2">
      {estado === "Borrador" && <AccionesBorrador cotizacionId={cotizacionId} onCambiarEstado={onCambiarEstado} puedeEnviar={acciones.enviar} />}
      {esBorradorOEnviada && <AccionesBorradorOEnviada onCambiarEstado={onCambiarEstado} puedeAceptarRechazar={acciones.aceptar} />}
      {esAceptada && esProspecto && (
        <Button size="sm" onClick={onAbrirConvertir}>Convertir a Cliente</Button>
      )}
      {mostrarCrearEmbarque && <AccionCrearEmbarque cotizacionId={cotizacionId} numContenedores={numContenedores} />}
      {mostrarRecotizar && (
        <>
          <Button variant="outline" size="sm" onClick={() => setRecotizarOpen(true)}>
            Re-cotizar
          </Button>
          <RecotizarModal
            open={recotizarOpen}
            onOpenChange={setRecotizarOpen}
            cotizacionId={cotizacionId}
            versionActual={version ?? 1}
          />
        </>
      )}
    </div>
  );
}



