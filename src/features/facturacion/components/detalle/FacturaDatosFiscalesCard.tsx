/**
 * FacturaDatosFiscalesCard — "Configuración de timbrado" del borrador.
 * v13.166.0: auto-guardado (debounce 500 ms), sin botón "Guardar cambios".
 *   Indicador de estado en el header (Guardando… / Guardado ✓ / Error).
 *   El botón "Obtener TC DOF" persiste al aplicar (via el mismo auto-save).
 * v13.164.3 — se removió Serie (FacturAPI la asigna) y el checklist fiscal
 *   (ahora vive en `FacturaReceptorCard`).
 */
import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  fetchClienteFiscal,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
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

interface Props {
  factura: FacturaDetalle;
  /**
   * Conceptos vivos del borrador: se usan sólo para avisar de la limitación
   * PPD + "No objeto de impuesto" mientras se captura, sin esperar al timbrado.
   */
  conceptos?: ReadonlyArray<LineaNoObjeto>;
}

export function FacturaDatosFiscalesCard({ factura, conceptos = [] }: Props) {
  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: queryKeys.facturacion.clienteFiscal(factura.cliente_id),
    enabled: !!factura.cliente_id,
    queryFn: () => fetchClienteFiscal(factura.cliente_id!),
  });

  const iniciales = inicialesDatosFiscales(factura);
  const [usoCfdi, setUsoCfdi] = useState(iniciales.usoCfdi);
  const [formaPago, setFormaPago] = useState(iniciales.formaPago);
  const [metodoPago, setMetodoPago] = useState(iniciales.metodoPago);
  const [diasCredito, setDiasCredito] = useState<number>(iniciales.diasCredito);
  const [tipoCambio, setTipoCambio] = useState<number | null>(iniciales.tipoCambio);
  const [notas, setNotas] = useState(iniciales.notas);

  // Sincroniza con el default del cliente al cargar.
  useEffect(() => {
    if (cliente?.uso_cfdi_default && !factura.uso_cfdi) {
      setUsoCfdi(cliente.uso_cfdi_default);
    }
  }, [cliente?.uso_cfdi_default, factura.uso_cfdi]);

  const { estado, ultimoGuardado } = useAutoSaveDatosFiscales(factura.id, factura.moneda, {
    usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas,
  });

  // B-03: TC DOF vigente en la fecha de emisión de la factura, no el de hoy.
  const obtenerTC = useBanxicoTipoCambio(factura.moneda, setTipoCambio, factura.fecha_emision);

  // B12: el borrador USD nace sin T/C; también avisamos si quedó fuera de banda.
  const avisoTC = avisoTipoCambioFactura(factura.moneda, tipoCambio);

  // La factura PPD con renglones "No objeto" SÍ se emite; lo que puede quedar
  // pendiente es el REP del cobro ⇒ advertencia informativa, nunca bloqueo.
  const avisoPpdNoObjeto = ppdConNoObjetoRequiereAviso(metodoPago, conceptos);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Configuración de timbrado</CardTitle>
        <AutoSaveIndicator estado={estado} ultimoGuardado={ultimoGuardado} />
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
          <Alert variant="warning" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <AlertDescription>{AVISO_NO_OBJETO_PPD_REP}</AlertDescription>
          </Alert>
        )}
        <DatosFiscalesForm
          usoCfdi={usoCfdi} setUsoCfdi={setUsoCfdi}
          formaPago={formaPago} setFormaPago={setFormaPago}
          metodoPago={metodoPago} setMetodoPago={setMetodoPago}
          diasCredito={diasCredito} setDiasCredito={setDiasCredito}
          tipoCambio={tipoCambio} setTipoCambio={setTipoCambio}
          notas={notas} setNotas={setNotas}
          mostrarTipoCambio={factura.moneda !== "MXN"}
          fechaEmision={factura.fecha_emision}
          moneda={factura.moneda}
        />

        {factura.moneda !== "MXN" && (
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={obtenerTC.isPending}
              onClick={() => obtenerTC.mutate()}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${obtenerTC.isPending ? "animate-spin" : ""}`} />
              {obtenerTC.isPending ? "Consultando Banxico…" : `Obtener TC DOF de hoy (${factura.moneda})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
