/**
 * Captura de factura de proveedor — versión reescrita.
 * - Dialog scrollable (xl + max-h 85vh) con footer sticky.
 * - Formulario delegado a FacturaProveedorFormFields (secciones tituladas).
 * - Validación inline + toast.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { useCrearFacturaProveedor } from "@/hooks/cxp";
import { usePresupuestoCategorias } from "@/hooks/presupuesto";
import {
  FacturaProveedorFormFields, type FacturaFormValues,
} from "./FacturaProveedorFormFields";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);

function initialValues(): FacturaFormValues {
  const t = today();
  return {
    provId: "", provNombre: "", folio: "",
    emision: t, diasCredito: 30, vencimiento: addDays(t, 30),
    moneda: "MXN", tc: "",
    subtotal: "", iva: "", retenciones: "",
    categoriaId: "", notas: "",
  };
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const crear = useCrearFacturaProveedor();
  const cats = usePresupuestoCategorias(true);
  const [values, setValues] = useState<FacturaFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});

  const total = useMemo(() => {
    const s = Number(values.subtotal) || 0;
    const i = Number(values.iva) || 0;
    const r = Number(values.retenciones) || 0;
    return s + i - r;
  }, [values.subtotal, values.iva, values.retenciones]);

  const handleChange = <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "emision" || k === "diasCredito") {
        next.vencimiento = addDays(next.emision, Number(next.diasCredito) || 0);
      }
      return next;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleProveedor = (id: string, nombre: string) => {
    setValues((p) => ({ ...p, provId: id, provNombre: nombre }));
    if (errors.provId) setErrors((e) => ({ ...e, provId: undefined }));
  };

  const reset = () => {
    setValues(initialValues());
    setErrors({});
  };

  const validate = () => {
    const next: Partial<Record<keyof FacturaFormValues, string>> = {};
    if (!values.provId) next.provId = "Selecciona un proveedor";
    if (!values.folio.trim()) next.folio = "Captura el folio del proveedor";
    if (total <= 0) next.subtotal = "El total debe ser mayor a 0";
    if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
      next.tc = "Captura el tipo de cambio";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      toast.error("Revisa los campos marcados");
      return;
    }
    try {
      await crear.mutateAsync({
        proveedor_id: values.provId,
        proveedor_nombre: values.provNombre,
        folio_proveedor: values.folio.trim(),
        fecha_emision: values.emision,
        fecha_vencimiento: values.vencimiento,
        dias_credito: Number(values.diasCredito) || 0,
        moneda: values.moneda,
        tipo_cambio_usd: Number(values.tc) || 0,
        subtotal: Number(values.subtotal) || 0,
        iva: Number(values.iva) || 0,
        retenciones: Number(values.retenciones) || 0,
        total,
        estado: "Vigente",
        notas: values.notas,
        categoria_presupuesto_id: values.categoriaId || null,
        created_by: user?.id,
      });
      toast.success("Factura de proveedor capturada");
      reset();
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Error al capturar");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={cn(
          dialogSize.xl,
          "max-h-[90vh] flex flex-col gap-0 p-0",
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Capturar factura de proveedor</DialogTitle>
          <DialogDescription>
            Registra la factura recibida para abrir su saldo en Cuentas por Pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FacturaProveedorFormFields
            values={values}
            onChange={handleChange}
            onProveedor={handleProveedor}
            categorias={cats.data ?? []}
            total={total}
            errors={errors}
          />
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {crear.isPending ? "Guardando…" : "Guardar factura"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
