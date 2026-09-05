import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecotizarModal } from "@/features/cotizacion/components/versionado/RecotizarModal";
import { accionesCotizacionPermitidas } from "@/features/cotizacion/domain/cotizacion";
import { visibilidadAcciones } from "@/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad";
import {
  AccionesCaptura,
  AccionesBorradorOEnviada,
  AccionCrearEmbarque,
} from "@/features/cotizacion/components/CotizacionDetalleAccionesBotones";
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
    mostrarCrearEmbarque, mostrarFaltaVenta, mostrarRecotizar,
  } = visibilidadAcciones({
    estado,
    esProspecto,
    tieneEmbarquesVinculados,
    puedeAceptar: acciones.aceptar,
    puedeRechazar: acciones.rechazar,
    puedeAltaCliente,
    tieneOportunidad,
    tieneVenta: Number(total) > 0,
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
      {mostrarFaltaVenta && (
        <span className="self-center text-body-sm text-muted-foreground">
          Para crear el embarque falta capturar los conceptos de venta con importe (total en $0.00).
        </span>
      )}
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
