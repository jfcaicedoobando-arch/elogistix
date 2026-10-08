/**
 * FacturaDatosFiscalesCard — "Configuración de timbrado" del borrador.
 * v13.166.0: auto-guardado (debounce 500 ms), sin botón "Guardar cambios".
 *   Indicador de estado en el header (Guardando… / Guardado ✓ / Error).
 *   El botón "Obtener TC DOF" persiste al aplicar (via el mismo auto-save).
 * v13.164.3 — se removió Serie (FacturAPI la asigna) y el checklist fiscal
 *   (ahora vive en `FacturaReceptorCard`).
 */
import { rfcReceptorFactura } from "@/lib/financial/usoCfdiFiscal";
import { formaPagoParaMetodo } from "@/lib/financial/formaMetodoPago";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchClienteFiscal,
  type ClienteFiscalRow,
  type DatosTimbradoPatch,
} from "@/features/facturacion/services";
import { realinearFechaEmisionBorrador } from "@/features/facturacion/services/datosFiscalesCliente";
import { hoyMx } from "@/lib/date/mx";
import { notifyError } from "@/lib/ui/appFeedback";
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import { useBanxicoTipoCambio } from "@/features/facturacion/hooks/useBanxicoTipoCambio";
import { useAutoSaveDatosFiscales } from "@/features/facturacion/hooks/useAutoSaveDatosFiscales";
import {
  avisoTipoCambioFactura,
  inicialesDatosFiscales,
} from "@/features/facturacion/domain/datosFiscalesForm";
import {
  AVISO_NO_OBJETO_PPD_REP,
  ppdConNoObjetoRequiereAviso,
  type LineaNoObjeto,
} from "@/lib/financial/noObjetoFiscal";
import { DatosFiscalesForm } from "./DatosFiscalesForm";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { queryKeys } from "@/lib/query";
import { formatDate } from "@/lib/formatters";

interface Props {
  factura: FacturaDetalle;
  /**
   * Conceptos vivos del borrador: se usan sólo para avisar de la limitación
   * PPD + "No objeto de impuesto" mientras se captura, sin esperar al timbrado.
   */
  conceptos?: ReadonlyArray<LineaNoObjeto>;
}

/** Aislamiento de captura: cambiar factura/empresa descarta sus timers, nunca reutiliza campos. */
export function FacturaDatosFiscalesCard(props: Props) {
  return <FacturaDatosFiscalesContenido key={`${props.factura.organization_id}:${props.factura.id}`} {...props} />;
}

function FacturaDatosFiscalesContenido({ factura, conceptos = [] }: Props) {
  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: queryKeys.facturacion.clienteFiscal(factura.cliente_id),
    enabled: !!factura.cliente_id,
    queryFn: () => fetchClienteFiscal(factura.cliente_id!),
  });

  const iniciales = inicialesDatosFiscales(factura);
  const [usoCfdi, setUsoCfdi] = useState(iniciales.usoCfdi);
  const usoEditado = useRef(false);
  const [camposEditados, setCamposEditados] = useState<(keyof DatosTimbradoPatch)[]>([]);
  const editar = (...campos: (keyof DatosTimbradoPatch)[]) => setCamposEditados((prev) => [...new Set([...prev, ...campos])]);
  const elegirUsoCfdi = (valor: string) => { usoEditado.current = true; editar("uso_cfdi"); setUsoCfdi(valor); };
  const [formaPago, setFormaPago] = useState(iniciales.formaPago);
  const [metodoPago, setMetodoPago] = useState(iniciales.metodoPago);
  const [diasCredito, setDiasCredito] = useState<number>(iniciales.diasCredito);
  const [tipoCambio, setTipoCambio] = useState<number | null>(iniciales.tipoCambio);
  const [notas, setNotas] = useState(iniciales.notas);

  // Una respuesta de una instancia anterior puede llegar después de volver a
  // esta factura. Hidratar sólo campos intactos; nunca convertirla en una edición.
  useEffect(() => {
    const inicial = inicialesDatosFiscales(factura);
    if (!usoEditado.current) setUsoCfdi(factura.uso_cfdi ?? cliente?.uso_cfdi_default ?? inicial.usoCfdi);
    if (!camposEditados.includes("forma_pago")) setFormaPago(inicial.formaPago);
    if (!camposEditados.includes("metodo_pago")) setMetodoPago(inicial.metodoPago);
    if (!camposEditados.includes("dias_credito")) setDiasCredito(inicial.diasCredito);
    if (!camposEditados.includes("tipo_cambio")) setTipoCambio(inicial.tipoCambio);
    if (!camposEditados.includes("notas")) setNotas(inicial.notas);
  }, [factura, cliente?.uso_cfdi_default, camposEditados]);

  const { estado, ultimoGuardado, reintentar } = useAutoSaveDatosFiscales(factura.id, factura.moneda, {
    usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas,
  }, factura.organization_id, camposEditados);

  // El CFDI se certifica con la fecha del timbre: el borrador consulta el DOF
  // de HOY y realinea su fecha de emisión para que el trigger no lo regrese.
  const qc = useQueryClient();
  const hoy = hoyMx();
  const aplicarTcDeHoy = (tc: number | null) => {
    if (!tc) return;
    const aplicar = () => { editar("tipo_cambio"); setTipoCambio(tc); };
    if ((factura.fecha_emision ?? "").slice(0, 10) === hoy) return aplicar();
    void realinearFechaEmisionBorrador(factura.id, hoy)
      .then(() => {
        aplicar();
        void qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(factura.id) });
      })
      .catch((error) => notifyError(undefined, { title: "No se pudo actualizar la fecha de emisión", error, method: "FACTURA_FECHA_HOY" }));
  };
  const obtenerTC = useBanxicoTipoCambio(factura.moneda, aplicarTcDeHoy, hoy);

  // B12: el borrador USD nace sin T/C; también avisamos si quedó fuera de banda.
  const avisoTC = avisoTipoCambioFactura(factura.moneda, tipoCambio);

  // La factura PPD con renglones "No objeto" SÍ se emite; lo que puede quedar
  // pendiente es el REP del cobro ⇒ advertencia informativa, nunca bloqueo.
  const avisoPpdNoObjeto = ppdConNoObjetoRequiereAviso(metodoPago, conceptos);

  // P1 · Auditoría fiscal — al cambiar PUE↔PPD realineamos la forma de pago
  // (PPD ⇒ 99 "Por definir"; PUE limpia el 99) para no guardar un dato obsoleto.
  const cambiarMetodoPago = (valor: string) => {
    editar("metodo_pago", "forma_pago");
    setMetodoPago(valor);
    setFormaPago(formaPagoParaMetodo(valor, formaPago));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Configuración de timbrado</CardTitle>
        <div className="flex items-center gap-2">
          <AutoSaveIndicator estado={estado} ultimoGuardado={ultimoGuardado} />
          {estado === "error" && <Button type="button" variant="outline" size="sm" onClick={reintentar}>Reintentar guardado</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {avisoTC && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{avisoTC}</span>
          </div>
        )}
        {avisoPpdNoObjeto && (
          <Alert variant="info" role="status">
            <Info className="h-4 w-4" aria-hidden />
            <AlertDescription>{AVISO_NO_OBJETO_PPD_REP}</AlertDescription>
          </Alert>
        )}
        <DatosFiscalesForm
          receptor={{ rfc: rfcReceptorFactura(factura.rfc_cliente, cliente?.rfc), regimen: cliente?.regimen_fiscal ?? "" }}
          usoCfdi={usoCfdi} setUsoCfdi={elegirUsoCfdi}
          formaPago={formaPago} setFormaPago={(v) => { editar("forma_pago"); setFormaPago(v); }}
          metodoPago={metodoPago} setMetodoPago={cambiarMetodoPago}
          diasCredito={diasCredito} setDiasCredito={(v) => { editar("dias_credito"); setDiasCredito(v); }}
          tipoCambio={tipoCambio} setTipoCambio={(v) => { editar("tipo_cambio"); setTipoCambio(v); }}
          notas={notas} setNotas={(v) => { editar("notas"); setNotas(v); }}
          mostrarTipoCambio={factura.moneda !== "MXN"}
          fechaEmision={factura.fecha_emision}
          moneda={factura.moneda}
        />

        {factura.moneda !== "MXN" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={obtenerTC.isPending}
              onClick={() => obtenerTC.mutate()}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${obtenerTC.isPending ? "animate-spin" : ""}`} />
              {obtenerTC.isPending ? "Consultando Banxico…" : `Consultar TC DOF (${factura.moneda})`}
            </Button>
            <span className="text-body-sm text-muted-foreground">Fecha de emisión: {factura.fecha_emision ? formatDate(factura.fecha_emision) : "hoy"}.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
