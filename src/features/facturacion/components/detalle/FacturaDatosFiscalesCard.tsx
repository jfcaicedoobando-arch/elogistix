/**
 * FacturaDatosFiscalesCard — "Configuración de timbrado" del borrador.
 * v13.164.3: se removió Serie (FacturAPI la asigna) y el checklist fiscal
 * (ahora vive en `FacturaReceptorCard`). Solo edita los campos que sí puede
 * elegir el usuario: Uso CFDI, Forma/Método de pago, Días crédito, TC, Notas.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  type DatosTimbradoPatch,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import {
  inicialesDatosFiscales,
  buildDatosTimbradoPatch,
} from "@/features/facturacion/domain/datosFiscalesForm";
import { DatosFiscalesForm } from "./DatosFiscalesForm";

interface Props {
  factura: FacturaDetalle;
}

export function FacturaDatosFiscalesCard({ factura }: Props) {
  const qc = useQueryClient();

  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: ["cliente_fiscal", factura.cliente_id],
    enabled: !!factura.cliente_id,
    queryFn: () => fetchClienteFiscal(factura.cliente_id!),
  });

  const iniciales = inicialesDatosFiscales(factura);
  const [usoCfdi, setUsoCfdi] = useState(iniciales.usoCfdi);
  const [formaPago, setFormaPago] = useState(iniciales.formaPago);
  const [metodoPago, setMetodoPago] = useState(iniciales.metodoPago);
  const [diasCredito, setDiasCredito] = useState<number>(iniciales.diasCredito);
  const [tipoCambio, setTipoCambio] = useState<number>(iniciales.tipoCambio);
  const [notas, setNotas] = useState(iniciales.notas);

  // Sincroniza con el default del cliente al cargar.
  useEffect(() => {
    if (cliente?.uso_cfdi_default && !factura.uso_cfdi) {
      setUsoCfdi(cliente.uso_cfdi_default);
    }
  }, [cliente?.uso_cfdi_default, factura.uso_cfdi]);

  const guardar = useMutation({
    mutationFn: (patch: DatosTimbradoPatch) => actualizarDatosTimbradoFactura(factura.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(factura.id) });
      toast.success("Datos fiscales actualizados");
    },
    onError: (err) =>
      notifyError(toast, { title: "No se pudo guardar", error: err, method: "FACTURA_DATOS_FISCALES" }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    guardar.mutate(
      buildDatosTimbradoPatch(
        { usoCfdi, formaPago, metodoPago, diasCredito, tipoCambio, notas },
        factura.moneda,
      ),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuración de timbrado</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DatosFiscalesForm
            usoCfdi={usoCfdi} setUsoCfdi={setUsoCfdi}
            formaPago={formaPago} setFormaPago={setFormaPago}
            metodoPago={metodoPago} setMetodoPago={setMetodoPago}
            diasCredito={diasCredito} setDiasCredito={setDiasCredito}
            tipoCambio={tipoCambio} setTipoCambio={setTipoCambio}
            notas={notas} setNotas={setNotas}
            mostrarTipoCambio={factura.moneda !== "MXN"}
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

          <div className="flex justify-end">
            <Button type="submit" disabled={guardar.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {guardar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
