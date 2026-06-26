/**
 * DialogCrearNotaCredito — captura una NC (CFDI tipo E) ligada a una factura
 * y opcionalmente la timbra de inmediato vía FacturApi.
 *
 * Patrón: `FormDialogShell` (memoria `mem://style/form-dialog-shell`).
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FileMinus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";
import { useToast } from "@/hooks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  crearNotaCredito,
  type ConceptoNotaCredito,
} from "@/features/facturacion/services/notasCredito";
import { useTimbrarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"factura_notas_credito">["moneda"];
type Motivo = Tables<"factura_notas_credito">["motivo"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  facturaNumero: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  /** Conceptos sugeridos desde la factura original (snapshot). */
  conceptosSugeridos?: ConceptoNotaCredito[];
}

const MOTIVOS: { value: Motivo; label: string }[] = [
  { value: "Devolucion", label: "Devolución" },
  { value: "Descuento", label: "Descuento" },
  { value: "Bonificacion", label: "Bonificación" },
  { value: "Error", label: "Error de facturación" },
  { value: "Otro", label: "Otro" },
];

const CLAVE_SAT_DEFAULT = "84111506";
const CLAVE_UNIDAD_DEFAULT = "E48";

function calcImporte(c: ConceptoNotaCredito): number {
  return Number(c.cantidad) * Number(c.precio_unitario);
}

function makeConcepto(): ConceptoNotaCredito {
  return {
    descripcion: "",
    cantidad: 1,
    precio_unitario: 0,
    clave_sat: CLAVE_SAT_DEFAULT,
    clave_unidad: CLAVE_UNIDAD_DEFAULT,
    unidad: "Unidad de servicio",
    tasa_iva: 0.16,
  };
}

export function DialogCrearNotaCredito({
  open, onOpenChange, facturaId, facturaNumero, monedaFactura, tipoCambioFactura,
  saldoFactura, uuidFacturaOriginal, conceptosSugeridos,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const timbrar = useTimbrarNotaCredito(facturaId);

  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [motivo, setMotivo] = useState<Motivo>("Descuento");
  const [descripcion, setDescripcion] = useState("");
  const [usoCfdi, setUsoCfdi] = useState("G02");
  const [formaPago, setFormaPago] = useState("03");
  const [conceptos, setConceptos] = useState<ConceptoNotaCredito[]>(() =>
    conceptosSugeridos?.length ? conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()],
  );
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setConceptos(conceptosSugeridos?.length ? conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()]);
      setFolio(`NC-${Date.now().toString().slice(-6)}`);
    }
  }, [open, conceptosSugeridos]);

  const monto = useMemo(
    () => conceptos.reduce((acc, c) => acc + calcImporte(c), 0),
    [conceptos],
  );

  const excedeSaldo = monto > saldoFactura + 0.01;
  const sinUuid = !uuidFacturaOriginal;
  const conceptosValidos =
    conceptos.length > 0 &&
    conceptos.every((c) => c.descripcion.trim() && c.cantidad > 0 && c.precio_unitario >= 0);
  const puedeGuardar = !!folio.trim() && !!descripcion.trim() && conceptosValidos && monto > 0 && !excedeSaldo;
  const puedeTimbrar = puedeGuardar && !sinUuid;

  const crearMut = useMutation({
    mutationFn: () => crearNotaCredito({
      factura_id: facturaId,
      folio: folio.trim(),
      motivo,
      descripcion: descripcion.trim(),
      monto,
      moneda: monedaFactura,
      tipo_cambio: tipoCambioFactura || 1,
      fecha_emision: fecha,
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      conceptos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: ["factura_notas_credito", "recientes"] });
    },
  });

  const updateConcepto = (i: number, patch: Partial<ConceptoNotaCredito>) =>
    setConceptos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const removeConcepto = (i: number) =>
    setConceptos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleSubmit = async (timbrarAhora: boolean) => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const nueva = await crearMut.mutateAsync();
      toast({ title: "Nota de crédito creada", description: `Folio ${nueva.folio}` });
      if (timbrarAhora && !sinUuid) {
        await timbrar.mutateAsync(nueva.id);
      }
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo crear la nota de crédito",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setGuardando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
        Cancelar
      </Button>
      <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={!puedeGuardar || guardando}>
        Guardar borrador
      </Button>
      <Button onClick={() => handleSubmit(true)} disabled={!puedeTimbrar || guardando}>
        {guardando ? "Procesando…" : "Guardar y timbrar"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileMinus}
      title={`Nueva nota de crédito · ${facturaNumero}`}
      description={
        <>
          Saldo de la factura:{" "}
          <strong className="tabular-nums">{saldoFactura.toFixed(2)} {monedaFactura}</strong>
        </>
      }
      size="lg"
      footer={footer}
    >
      {sinUuid && (
        <Alert variant="destructive">
          <AlertDescription>
            La factura original aún no está timbrada. Puedes guardar el borrador,
            pero no podrás timbrar la NC hasta que la factura tenga UUID fiscal.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nc-folio">Folio interno *</Label>
          <Input id="nc-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="NC-001" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nc-fecha">Fecha *</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label>Motivo SAT *</Label>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Uso CFDI *</Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Forma de pago *</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nc-desc">Descripción / Justificación *</Label>
        <Textarea
          id="nc-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          rows={2} placeholder="Motivo del crédito al cliente"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Conceptos *</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConceptos((p) => [...p, makeConcepto()])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {conceptos.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={c.descripcion}
                  onChange={(e) => updateConcepto(i, { descripcion: e.target.value })}
                  placeholder="Descripción del concepto"
                />
              </div>
              <div className="col-span-3 sm:col-span-2 space-y-1">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number" min="0.01" step="0.01" value={c.cantidad}
                  onChange={(e) => updateConcepto(i, { cantidad: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-5 sm:col-span-2 space-y-1">
                <Label className="text-xs">P. Unitario</Label>
                <Input
                  type="number" min="0" step="0.01" value={c.precio_unitario}
                  onChange={(e) => updateConcepto(i, { precio_unitario: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-3 sm:col-span-2 space-y-1">
                <Label className="text-xs">Clave SAT</Label>
                <Input
                  value={c.clave_sat ?? ""}
                  onChange={(e) => updateConcepto(i, { clave_sat: e.target.value })}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => removeConcepto(i)} disabled={conceptos.length === 1}
                  aria-label="Eliminar concepto"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end text-sm pt-1">
          <span className="text-muted-foreground mr-2">Total:</span>
          <strong className={`tabular-nums ${excedeSaldo ? "text-destructive" : ""}`}>
            {monto.toFixed(2)} {monedaFactura}
          </strong>
        </div>
        {excedeSaldo && (
          <p className="text-xs text-destructive">El monto excede el saldo de la factura.</p>
        )}
      </div>
    </FormDialogShell>
  );
}
