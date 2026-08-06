/**
 * FacturaDatosFiscalesCard — "Configuración de timbrado" del borrador.
 * v13.166.0: auto-guardado (debounce 500 ms), sin botón "Guardar cambios".
 *   Indicador de estado en el header (Guardando… / Guardado ✓ / Error).
 *   El botón "Obtener TC DOF" persiste al aplicar (via el mismo auto-save).
 * v13.164.3 — se removió Serie (FacturAPI la asigna) y el checklist fiscal
 *   (ahora vive en `FacturaReceptorCard`).
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { inicialesDatosFiscales } from "@/features/facturacion/domain/datosFiscalesForm";
import { DatosFiscalesForm } from "./DatosFiscalesForm";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { queryKeys } from "@/lib/query";

interface Props {
  factura: FacturaDetalle;
}

export function FacturaDatosFiscalesCard({ factura }: Props) {
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

  const obtenerTC = useBanxicoTipoCambio(factura.moneda, setTipoCambio);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle >Configuración de timbrado</CardTitle>
        <AutoSaveIndicator estado={estado} ultimoGuardado={ultimoGuardado} />
      </CardHeader>
      <CardContent className="space-y-4">
        {factura.moneda !== "MXN" && (tipoCambio == null || tipoCambio <= 0) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            ⚠ Falta capturar el tipo de cambio del día. Pulsa
            <span className="font-semibold"> “Obtener TC DOF de hoy”</span> o
            escríbelo manualmente antes de timbrar.
          </div>
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
