/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Encapsula estado del formulario, parseo CFDI, validación y submit.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import {
  findProveedorByRfc,
} from "@/services/proveedor";
import {
  subirArchivosCfdiFactura,
  type CfdiParsedResponse,
} from "@/services/cxp";
import { useCrearFacturaProveedor } from "@/hooks/cxp";
import type { Database } from "@/integrations/supabase/types";
import type { FacturaFormValues } from "@/components/cxp/facturaFormPrimitives";
import type { CargaMode } from "@/components/cxp/CargaCfdiSection";

type Moneda = Database["public"]["Enums"]["moneda"];

interface PendingCfdi {
  uuid: string;
  rfcEmisor: string;
  xmlFile: File;
  pdfFile: File | null;
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

export function useNuevaFacturaProveedorForm(onDone: () => void) {
  const { user } = useAuth();
  const { organizationId } = useOrgFilter();
  const crear = useCrearFacturaProveedor();
  const [values, setValues] = useState<FacturaFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [mode, setMode] = useState<CargaMode>("manual");
  const [pendingCfdi, setPendingCfdi] = useState<PendingCfdi | null>(null);
  const [askCrearProv, setAskCrearProv] = useState<{ rfc: string; nombre: string } | null>(null);

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
    setMode("manual");
    setPendingCfdi(null);
    setAskCrearProv(null);
  };

  const handleCfdiParsed = async (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    const c = data.cfdi;
    const monedaValida: Moneda = c.moneda === "USD" || c.moneda === "EUR" ? c.moneda : "MXN";

    let provId = "";
    let provNombre = c.emisor.nombre;
    try {
      const found = await findProveedorByRfc(c.emisor.rfc);
      if (found) { provId = found.id; provNombre = found.nombre; }
      else setAskCrearProv({ rfc: c.emisor.rfc, nombre: c.emisor.nombre });
    } catch { /* lookup opcional */ }

    setValues({
      provId, provNombre,
      folio: [c.serie, c.folio].filter(Boolean).join("-") || c.uuid.slice(0, 8),
      emision: c.fecha || today(),
      diasCredito: 30,
      vencimiento: addDays(c.fecha || today(), 30),
      moneda: monedaValida,
      tc: monedaValida === "MXN" ? "" : String(c.tipo_cambio || ""),
      subtotal: String(c.subtotal || ""),
      iva: String(c.iva_trasladado || ""),
      retenciones: String(c.retenciones || ""),
      categoriaId: data.ai.categoria_id ?? "",
      notas: data.ai.notas || "",
    });
    setErrors({});
    setPendingCfdi({ uuid: c.uuid, rfcEmisor: c.emisor.rfc, xmlFile: files.xml, pdfFile: files.pdf });
  };

  const validate = (): boolean => {
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
      const created = await crear.mutateAsync({
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
        uuid_fiscal: pendingCfdi?.uuid ?? null,
        rfc_proveedor: pendingCfdi?.rfcEmisor ?? null,
      });
      if (pendingCfdi && created?.id) {
        try {
          await subirArchivosCfdiFactura({
            facturaId: created.id,
            organizationId,
            xmlFile: pendingCfdi.xmlFile,
            pdfFile: pendingCfdi.pdfFile,
          });
        } catch (uploadErr) {
          const err = uploadErr as { message?: string };
          toast.warning(`Factura guardada pero el XML/PDF falló: ${err.message ?? "error"}`);
        }
      }
      toast.success("Factura de proveedor capturada");
      reset();
      onDone();
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (err.code === "23505" || /uuid_fiscal/i.test(err.message ?? "")) {
        toast.error("Ya existe una factura con este UUID fiscal (CFDI duplicado).");
      } else {
        toast.error(err.message ?? "Error al capturar");
      }
    }
  };

  return {
    values, errors, mode, setMode,
    total, pendingCfdi, askCrearProv, setAskCrearProv,
    handleChange, handleProveedor, handleCfdiParsed,
    reset, submit,
    isPending: crear.isPending,
    organizationId,
  };
}
