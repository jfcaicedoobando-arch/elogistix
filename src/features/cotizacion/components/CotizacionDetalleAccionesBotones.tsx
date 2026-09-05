/**
 * Subcomponentes de botones usados por `CotizacionDetalleAcciones`.
 * Extraídos para mantener el archivo principal bajo el límite de líneas
 * (Power-of-10); sin cambios de comportamiento.
 */
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CrearEmbarqueConRevalidacion } from "@/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion";

export interface AccionesCapturaProps {
  cotizacionId: string;
  onCambiarEstado: (e: "Enviada" | "Aceptada" | "Rechazada") => void;
  puedeEnviar: boolean;
  esSolicitada: boolean;
  total: number;
}

/**
 * R-02 — Una cotización "Solicitada" (creada por el cliente desde el portal)
 * también necesita entrar a captura: sin este botón quedaba en un callejón sin
 * salida. R-08 — cuando el total es $0 se explica por qué no se puede enviar.
 */
export function AccionesCaptura({
  cotizacionId, onCambiarEstado, puedeEnviar, esSolicitada, total,
}: AccionesCapturaProps) {
  const navigate = useNavigate();
  return (
    <>
      <Button
        variant={esSolicitada ? "default" : "outline"}
        size="sm"
        onClick={() => navigate(`/cotizaciones/${cotizacionId}/editar`)}
      >
        {esSolicitada ? "Completar cotización" : "Editar"}
      </Button>
      {puedeEnviar && (
        <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Enviada")}>Marcar como Enviada</Button>
      )}
      {!puedeEnviar && Number(total) <= 0 && (
        <span className="self-center text-body-sm text-muted-foreground">
          Agrega al menos un concepto con importe para poder enviarla.
        </span>
      )}
    </>
  );
}

export function AccionesBorradorOEnviada({
  onCambiarEstado, puedeAceptar, puedeRechazar,
}: {
  onCambiarEstado: AccionesCapturaProps["onCambiarEstado"];
  puedeAceptar: boolean;
  puedeRechazar: boolean;
}) {
  if (!puedeAceptar && !puedeRechazar) return null;
  return (
    <>
      {puedeRechazar && (
        <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Rechazada")}>Rechazar</Button>
      )}
      {puedeAceptar && <Button size="sm" onClick={() => onCambiarEstado("Aceptada")}>Aceptar</Button>}
    </>
  );
}

export function AccionCrearEmbarque({
  cotizacionId, numContenedores,
}: { cotizacionId: string; numContenedores: number }) {
  return (
    <CrearEmbarqueConRevalidacion
      cotizacionId={cotizacionId}
      numContenedores={numContenedores}
    />
  );
}
