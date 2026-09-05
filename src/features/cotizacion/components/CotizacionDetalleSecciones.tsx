import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RecotizarModal } from "@/features/cotizacion/components/versionado/RecotizarModal";
import { CrearEmbarqueConRevalidacion } from "@/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion";
import { accionesCotizacionPermitidas } from "@/features/cotizacion/domain/cotizacion";
import type { AppRole } from "@/types/appRole";
import { BadgeClienteDeCasa } from "@/components/shared/BadgeClienteDeCasa";

export { CotizacionDetalleEmbarques } from "@/features/cotizacion/components/CotizacionDetalleEmbarques";

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
  /** Q-04b — usuario que creó la cotización (segregación de funciones). */
  creadaPor?: string | null;
  /** Q-04b — usuario autenticado. */
  usuarioActual?: string | null;
  /** v13.624.0 — política del cliente: ¿requiere autorizar cotizaciones? */
  requiereAutorizacionCliente?: boolean;
  /** P0 — ¿el rol puede dar de alta clientes? (espejo de la RPC de conversión). */
  puedeAltaCliente?: boolean;
  /** P0 — la conversión exige oportunidad ligada (cotización ganadora). */
  tieneOportunidad?: boolean;
}


/**
 * R-02 — Una cotización "Solicitada" (creada por el cliente desde el portal)
 * también necesita entrar a captura: sin este botón quedaba en un callejón sin
 * salida. R-08 — cuando el total es $0 se explica por qué no se puede enviar.
 */
function AccionesCaptura({
  cotizacionId, onCambiarEstado, puedeEnviar, esSolicitada, total,
}: {
  cotizacionId: string;
  onCambiarEstado: AccionesProps["onCambiarEstado"];
  puedeEnviar: boolean;
  esSolicitada: boolean;
  total: number;
}) {
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

function AccionesBorradorOEnviada({ onCambiarEstado, puedeAceptar, puedeRechazar }: { onCambiarEstado: AccionesProps["onCambiarEstado"]; puedeAceptar: boolean; puedeRechazar: boolean }) {
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

function AccionCrearEmbarque({ cotizacionId, numContenedores }: { cotizacionId: string; numContenedores: number }) {
  return (
    <CrearEmbarqueConRevalidacion
      cotizacionId={cotizacionId}
      numContenedores={numContenedores}
    />
  );
}

/**
 * Visibilidad de los botones del encabezado de cotización. Función pura para
 * bajar la complejidad del componente (Power-of-10).
 * Nota: sólo se puede re-cotizar si aún no hay embarque generado; con embarque
 * vivo el flujo correcto es crear una nueva cotización.
 */
function visibilidadAcciones(params: {
  estado: string;
  esProspecto: boolean;
  tieneEmbarquesVinculados: boolean;
  puedeAceptar: boolean;
  puedeRechazar: boolean;
  puedeAltaCliente: boolean;
  tieneOportunidad: boolean;
  /** P0 — sin venta capturada no se puede generar el embarque. */
  tieneVenta: boolean;
}) {
  const {
    estado, esProspecto, tieneEmbarquesVinculados, puedeAceptar, puedeRechazar,
    puedeAltaCliente, tieneOportunidad, tieneVenta,
  } = params;
  const esAceptada = estado === "Aceptada";
  const respuestaEnSolicitada = puedeAceptar || puedeRechazar;
  return {
    esEnCaptura: estado === "Borrador" || estado === "Solicitada",
    mostrarAceptarRechazar:
      estado === "Borrador" || estado === "Enviada" ||
      (estado === "Solicitada" && respuestaEnSolicitada),
    esAceptada,
    // P0 — la puerta visible coincide con la cerradura: rol con alta de
    // clientes + prospecto aceptado + oportunidad ligada. Sin oportunidad queda
    // sólo el banner que guía a vincularla.
    mostrarConvertirCliente: esAceptada && esProspecto && puedeAltaCliente && tieneOportunidad,
    mostrarCrearEmbarque: esAceptada && !esProspecto && !tieneEmbarquesVinculados,
    mostrarRecotizar: esAceptada && !tieneEmbarquesVinculados,
  };
}

export function CotizacionDetalleAcciones({
  estado, esProspecto, numContenedores, cotizacionId, version,
  tieneEmbarquesVinculados = false,
  onCambiarEstado, onAbrirConvertir, total, rol, creadaPor, usuarioActual,
  requiereAutorizacionCliente = true,
  puedeAltaCliente = false,
  tieneOportunidad = false,
}: AccionesProps) {
  const [recotizarOpen, setRecotizarOpen] = useState(false);
  const acciones = accionesCotizacionPermitidas(
    estado,
    total,
    rol,
    { creadaPor, usuarioActual },
    requiereAutorizacionCliente,
  );
  const {
    esEnCaptura, mostrarAceptarRechazar, mostrarConvertirCliente,
    mostrarCrearEmbarque, mostrarRecotizar,
  } = visibilidadAcciones({
    estado,
    esProspecto,
    tieneEmbarquesVinculados,
    puedeAceptar: acciones.aceptar,
    puedeRechazar: acciones.rechazar,
    puedeAltaCliente,
    tieneOportunidad,
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!requiereAutorizacionCliente && <BadgeClienteDeCasa tipo="cotizacion" />}
      {esEnCaptura && (
        <AccionesCaptura
          cotizacionId={cotizacionId}
          onCambiarEstado={onCambiarEstado}
          puedeEnviar={acciones.enviar}
          esSolicitada={estado === "Solicitada"}
          total={total}
        />
      )}
      {mostrarAceptarRechazar && <AccionesBorradorOEnviada onCambiarEstado={onCambiarEstado} puedeAceptar={acciones.aceptar} puedeRechazar={acciones.rechazar} />}
      {mostrarConvertirCliente && (
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



