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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/lib/observability/notifyError";
import {
  USOS_CFDI_SAT,
  FORMAS_PAGO_SAT,
  METODOS_PAGO_SAT,
} from "@/constants/catalogosSAT";
import { convertirProformaAFactura } from "@/features/proformas/services/convertirAFactura";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proformaIds: string[];
  organizationId: string;
  diasCreditoDefault?: number;
}

interface SerieRow {
  id: string;
  prefijo: string;
  folio_actual: number;
  activa: boolean;
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

  // Series de facturación activas para esta organización.
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
      navigate(`/facturacion/${res.facturaId}`);
    },
    onError: (err) => notifyError(err, "Convertir proforma a factura"),
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

      <FormDialogSection title="Datos fiscales" cols={2}>
        <div className="space-y-1">
          <Label>Serie</Label>
          <Select value={serieId} onValueChange={setSerieId}>
            <SelectTrigger><SelectValue placeholder="Selecciona una serie" /></SelectTrigger>
            <SelectContent>
              {(series ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prefijo} (último folio: {s.folio_actual})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Método de pago</Label>
          <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as "PUE" | "PPD")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGO_SAT.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Forma de pago</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Uso CFDI</Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Días de crédito</Label>
          <Input
            type="number"
            min={0}
            value={diasCredito}
            onChange={(e) => setDiasCredito(Number(e.target.value) || 0)}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Notas internas (opcional)" cols={1}>
        <Textarea
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas que se guardan en la factura (no llegan al SAT)."
        />
      </FormDialogSection>

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
