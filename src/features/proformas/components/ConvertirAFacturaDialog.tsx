/**
 * ConvertirAFacturaDialog — convierte una o varias proformas aprobadas del
 * mismo cliente en una factura borrador (lista para timbrar).
 * Parte de la Fase 2 del flujo Proforma → Factura → Timbrado → Pago → REP.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { convertirProformaAFactura } from "@/features/proformas/services/convertirAFactura";
import {
  DatosFiscalesFactura,
  type SerieRow,
} from "./ConvertirAFacturaDialogFields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proformaIds: string[];
  organizationId: string;
  diasCreditoDefault?: number;
}

export function ConvertirAFacturaDialog({
  open,
  onOpenChange,
  proformaIds,
  organizationId,
  diasCreditoDefault,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serieId, setSerieId] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<"PUE" | "PPD">("PUE");
  const [formaPago, setFormaPago] = useState<string>("03");
  const [usoCfdi, setUsoCfdi] = useState<string>("G03");
  const [diasCredito, setDiasCredito] = useState<number>(diasCreditoDefault ?? 0);
  const [notas, setNotas] = useState<string>("");

  const { data: series } = useQuery<SerieRow[]>({
    queryKey: ["factura_series", organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factura_series")
        .select("id, prefijo, folio_actual, activa")
        .eq("organization_id", organizationId)
        .eq("activa", true)
        .order("prefijo");
      if (error) throw error;
      return (data ?? []) as SerieRow[];
    },
  });

  useEffect(() => {
    if (open && series && series.length > 0 && !serieId) {
      setSerieId(series[0].id);
    }
  }, [open, series, serieId]);

  const mutation = useMutation({
    mutationKey: ["fiscal", "proforma-a-factura"],
    mutationFn: () =>
      convertirProformaAFactura({
        proformaIds,
        serieId,
        metodoPago,
        formaPago,
        usoCfdi,
        diasCredito,
        notas: notas.trim() || null,
        requestId: crypto.randomUUID(),
      }),
    onSuccess: (res) => {
      toast({
        title: "Factura generada",
        description: `Borrador ${res.facturaNumero} listo para timbrar.`,
      });
      qc.invalidateQueries({ queryKey: ["proformas"] });
      qc.invalidateQueries({ queryKey: ["proforma-detalle"] });
      qc.invalidateQueries({ queryKey: ["facturas"] });
      onOpenChange(false);
      navigate(`/facturacion/${res.facturaId}?accion=timbrar`);
    },
    onError: (err) => notifyError(undefined, { error: err, title: "Convertir proforma a factura" }),
  });

  const sinSeries = !!series && series.length === 0;
  const puedeConvertir =
    !!serieId && !!formaPago && !!usoCfdi && proformaIds.length > 0 && !mutation.isPending;

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
        Cancelar
      </Button>
      <Button onClick={() => mutation.mutate()} disabled={!puedeConvertir}>
        {mutation.isPending ? "Generando…" : "Generar factura borrador"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={
        proformaIds.length > 1
          ? `Fusionar ${proformaIds.length} proformas en una factura`
          : "Convertir proforma a factura"
      }
      description="Genera una factura borrador con los conceptos de la(s) proforma(s) seleccionada(s). El timbrado ante el SAT se hará por separado desde la factura."
      size="md"
      footer={footer}
    >
      {sinSeries && (
        <Alert variant="destructive">
          <AlertDescription>
            Esta organización no tiene series de facturación activas. Crea una en Configuración →
            Facturación antes de continuar.
          </AlertDescription>
        </Alert>
      )}

      <DatosFiscalesFactura
        series={series}
        serieId={serieId} setSerieId={setSerieId}
        metodoPago={metodoPago} setMetodoPago={setMetodoPago}
        formaPago={formaPago} setFormaPago={setFormaPago}
        usoCfdi={usoCfdi} setUsoCfdi={setUsoCfdi}
        diasCredito={diasCredito} setDiasCredito={setDiasCredito}
        notas={notas} setNotas={setNotas}
      />

      {metodoPago === "PPD" && (
        <Alert>
          <AlertDescription className="text-xs">
            Las facturas <strong>PPD</strong> requerirán un Recibo Electrónico de Pago (REP) cada
            vez que registres un abono. Eso lo manejaremos automáticamente desde el módulo de pagos.
          </AlertDescription>
        </Alert>
      )}
    </FormDialogShell>
  );
}
