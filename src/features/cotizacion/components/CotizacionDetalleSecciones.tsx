import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecotizarModal } from "@/features/cotizacion/components/versionado/RecotizarModal";
import { accionesCotizacionPermitidas, puedeEscribirCotizaciones } from "@/features/cotizacion/domain/cotizacion";
import { visibilidadAcciones } from "@/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad";
import {
  AccionesCaptura,
  AccionesBorradorOEnviada,
  AccionCrearEmbarque,
} from "@/features/cotizacion/components/CotizacionDetalleAccionesBotones";
import type { AppRole } from "@/types/appRole";
import { AutorizacionCotizacion } from "@/features/cotizacion/components/autorizacion/AutorizacionCotizacion";
import { esAutorizadorCotizacion, requiereAutorizacionParaAvanzar } from "@/features/cotizacion/domain/autorizacionCotizacion";
import { BadgeClienteDeCasa } from "@/components/shared/BadgeClienteDeCasa";

export { CotizacionDetalleEmbarques } from "@/features/cotizacion/components/CotizacionDetalleEmbarques";

interface AutorizacionInterna {
  autorizadaAt?: string | null;
  autorizacionSolicitadaAt?: string | null;
  margenAutorizado?: number | null;
  clienteEspecial?: boolean;
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
  autorizacionInterna?: AutorizacionInterna;

}

export function CotizacionDetalleAcciones(props: AccionesProps) {
  const { estado, numContenedores, cotizacionId, version, onCambiarEstado, onAbrirConvertir, total, rol,
    requiereAutorizacionCliente = true, autorizacionInterna } = props;
  const [recotizarOpen, setRecotizarOpen] = useState(false);
  const { acciones, visibilidad } = resolverAcciones(props);
  const {
    esEnCaptura, mostrarAceptarRechazar, mostrarConvertirCliente,
    mostrarCrearEmbarque, mostrarFaltaVenta, mostrarRecotizar,
  } = visibilidad;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!requiereAutorizacionCliente && <BadgeClienteDeCasa tipo="cotizacion" />}
      {esEnCaptura && <AutorizacionEnCaptura cotizacionId={cotizacionId} estado={estado} rol={rol}
        total={total} autorizacionInterna={autorizacionInterna} />}
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

function resolverAcciones({ estado, total, rol, creadaPor, usuarioActual, esProspecto,
  requiereAutorizacionCliente = true, tieneEmbarquesVinculados = false,
  puedeAltaCliente = false, tieneOportunidad = false, autorizacionInterna = {},
}: AccionesProps) {
  const { clienteEspecial = false, autorizadaAt = null } = autorizacionInterna;
  const base = accionesCotizacionPermitidas(estado, total, rol, { creadaPor, usuarioActual }, requiereAutorizacionCliente);
  // Sin autorización interna no se envía ni se acepta desde captura (la base también lo bloquea).
  const bloqueada = !clienteEspecial && requiereAutorizacionParaAvanzar(estado, autorizadaAt);
  // Fase 3b: un prospecto no sale de borrador; primero se da de alta como cliente.
  const frenada = bloqueada || esProspecto;
  const acciones = { ...base, enviar: base.enviar && !frenada, aceptar: base.aceptar && !frenada };
  const visibilidad = visibilidadAcciones({
    estado,
    esProspecto,
    tieneEmbarquesVinculados,
    puedeAceptar: acciones.aceptar,
    puedeRechazar: acciones.rechazar,
    puedeAltaCliente,
    tieneOportunidad,
    tieneVenta: Number(total) > 0,
    puedeCrearEmbarque: acciones.crearEmbarque,
    puedeRecotizar: puedeEscribirCotizaciones(rol),
  });

  return { acciones, visibilidad };
}

function AutorizacionEnCaptura({ cotizacionId, estado, rol, total, autorizacionInterna = {} }:
  Pick<AccionesProps, "cotizacionId" | "estado" | "rol" | "total" | "autorizacionInterna">) {
  const { clienteEspecial = false, autorizadaAt = null, autorizacionSolicitadaAt = null,
    margenAutorizado = null } = autorizacionInterna;
  if (clienteEspecial) return (
    <span className="text-body-sm text-muted-foreground">Cliente especial: no requiere autorización</span>
  );
  return (
    <AutorizacionCotizacion cotizacionId={cotizacionId} estado={estado} autorizadaAt={autorizadaAt}
      solicitadaAt={autorizacionSolicitadaAt} margenAutorizado={margenAutorizado}
      puedeSolicitar={puedeEscribirCotizaciones(rol)} puedeAutorizar={esAutorizadorCotizacion(rol)}
      tieneTotal={Number(total) > 0} />
  );
}
