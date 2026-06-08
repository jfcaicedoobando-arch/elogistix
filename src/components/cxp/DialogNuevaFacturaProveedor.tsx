/**
 * Captura de factura de proveedor — soporta captura manual y carga de XML CFDI.
 * - Dialog scrollable con footer sticky.
 * - Toggle Manual / CFDI vía CargaCfdiSection.
 * - Si el RFC del CFDI no matchea proveedor, ofrece crear uno (CrearProveedorDesdeCfdiDialog).
 * - Tras guardar la factura, sube XML y PDF (opcional) a Storage `facturas/cfdi/...`.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import { supabase } from "@/integrations/supabase/client";
import { findProveedorByRfc } from "@/services/proveedor";
import { sanitizeFileName } from "@/lib/storage";
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
import { CargaCfdiSection, type CargaMode } from "./CargaCfdiSection";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import type { CfdiParsedResponse } from "@/services/cxp";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

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

interface PendingCfdi {
  uuid: string;
  rfcEmisor: string;
  xmlFile: File;
  pdfFile: File | null;
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { organizationId } = useOrgFilter();
  const crear = useCrearFacturaProveedor();
  const cats = usePresupuestoCategorias(true);
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

    // 1) Lookup proveedor por RFC
    let provId = "";
    let provNombre = c.emisor.nombre;
    try {
      const found = await findProveedorByRfc(c.emisor.rfc);
      if (found) {
        provId = found.id;
        provNombre = found.nombre;
      } else {
        setAskCrearProv({ rfc: c.emisor.rfc, nombre: c.emisor.nombre });
      }
    } catch {
      // ignore lookup errors; el usuario podrá seleccionarlo manualmente
    }

    // 2) Prellenar formulario
    setValues({
      provId,
      provNombre,
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
    setPendingCfdi({
      uuid: c.uuid,
      rfcEmisor: c.emisor.rfc,
      xmlFile: files.xml,
      pdfFile: files.pdf,
    });
  };

  const subirArchivosCfdi = async (facturaId: string, p: PendingCfdi) => {
    const base = `cfdi/${organizationId ?? "org"}/${facturaId}`;
    const xmlPath = `${base}/${sanitizeFileName(p.xmlFile.name)}`;
    const xmlUp = await supabase.storage.from("facturas").upload(xmlPath, p.xmlFile, {
      contentType: "application/xml", upsert: true,
    });
    if (xmlUp.error) throw xmlUp.error;

    let pdfPath: string | null = null;
    if (p.pdfFile) {
      pdfPath = `${base}/${sanitizeFileName(p.pdfFile.name)}`;
      const pdfUp = await supabase.storage.from("facturas").upload(pdfPath, p.pdfFile, {
        contentType: "application/pdf", upsert: true,
      });
      if (pdfUp.error) throw pdfUp.error;
    }

    const { error } = await supabase.from("proveedor_facturas").update({
      archivo_xml_url: xmlPath,
      archivo_pdf_url: pdfPath,
    }).eq("id", facturaId);
    if (error) throw error;
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
          await subirArchivosCfdi(created.id, pendingCfdi);
        } catch (uploadErr) {
          const err = uploadErr as { message?: string };
          toast.warning(`Factura guardada pero el XML/PDF falló: ${err.message ?? "error"}`);
        }
      }
      toast.success("Factura de proveedor capturada");
      reset();
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (err.code === "23505" || /uuid_fiscal/i.test(err.message ?? "")) {
        toast.error("Ya existe una factura con este UUID fiscal (CFDI duplicado).");
      } else {
        toast.error(err.message ?? "Error al capturar");
      }
    }
  };

  return (
    <>
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
              Registra la factura recibida. Si es de un proveedor mexicano, sube el XML CFDI y se prellenará automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <CargaCfdiSection
              mode={mode}
              onModeChange={setMode}
              categorias={cats.data ?? []}
              onParsed={handleCfdiParsed}
              cfdiReady={!!pendingCfdi}
            />

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

      {askCrearProv && (
        <CrearProveedorDesdeCfdiDialog
          open={!!askCrearProv}
          onOpenChange={(o) => { if (!o) setAskCrearProv(null); }}
          rfc={askCrearProv.rfc}
          nombre={askCrearProv.nombre}
          organizationId={organizationId}
          onCreated={(id, nombre) => {
            setValues((p) => ({ ...p, provId: id, provNombre: nombre }));
            setAskCrearProv(null);
          }}
        />
      )}
    </>
  );
}
