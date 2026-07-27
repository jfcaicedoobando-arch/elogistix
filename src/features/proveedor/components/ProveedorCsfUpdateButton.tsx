import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { Button } from "@/components/ui/button";
import { parseCsf, type CsfParsedData } from "@/features/cliente/services/csf";
import type { Tables } from "@/types/db";

import { notifyError } from "@/lib/ui/appFeedback";
interface Props {
  proveedor: Tables<"proveedores">;
  onUpdate: (id: string, patch: Record<string, string>) => Promise<unknown>;
}

function validarCsf(
  data: CsfParsedData,
  proveedor: Tables<"proveedores">,
): { ok: true } | { ok: false; msg: string; description?: string } {
  const rfcCsf = (data.rfc ?? "").trim().toUpperCase();
  const rfcProv = (proveedor.rfc ?? "").trim().toUpperCase();
  if (!rfcCsf) {
    return { ok: false, msg: "No se pudo extraer el RFC de la CSF. Verifica que el PDF sea legible." };
  }
  if (rfcCsf !== rfcProv) {
    return {
      ok: false,
      msg: "La CSF no corresponde a este proveedor",
      description: `La constancia pertenece a ${data.nombre ?? "otra empresa"} (RFC ${rfcCsf}). El proveedor tiene RFC ${rfcProv || "—"}. No se actualizó nada.`,
    };
  }
  return { ok: true };
}

function construirPatchCsf(data: CsfParsedData): Record<string, string> {
  const patch: Record<string, string> = {};
  if (data.nombre?.trim()) patch.nombre = data.nombre.trim();
  if (data.cp?.trim()) patch.cp = data.cp.trim();
  if (data.direccion?.trim()) patch.direccion = data.direccion.trim();
  if (data.ciudad?.trim()) patch.ciudad = data.ciudad.trim();
  if (data.estado?.trim()) patch.estado = data.estado.trim();
  if (data.regimen_fiscal?.trim()) patch.regimen_fiscal = data.regimen_fiscal.trim();
  return patch;
}

/**
 * Botón "Actualizar con CSF": parsea la Constancia, valida que el RFC
 * coincida con el proveedor y aplica únicamente los campos presentes.
 * Extraído de `ProveedorDetalle` para mantener ese archivo ≤200 líneas.
 */
export function ProveedorCsfUpdateButton({ proveedor, onUpdate }: Props) {
  const csfInputRef = useRef<HTMLInputElement>(null);
  const [csfLoading, setCsfLoading] = useState(false);

  const handleCsfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCsfLoading(true);
    let data: CsfParsedData;
    try {
      data = await parseCsf(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo procesar la CSF";
      notifyError(undefined, { title: msg, error: err, method: "PAGES_PROVEEDORES_PROVEEDORCSFUPDATEBUTTON_1" });
      setCsfLoading(false);
      return;
    }

    const validacion = validarCsf(data, proveedor);
    if (!validacion.ok) {
      notifyError(undefined, { title: validacion.msg, method: "PAGES_PROVEEDORES_PROVEEDORCSFUPDATEBUTTON_2" });
      setCsfLoading(false);
      return;
    }

    const patch = construirPatchCsf(data);
    if (Object.keys(patch).length === 0) {
      notifyWarning(undefined, { title: "La CSF se validó correctamente pero no contenía datos nuevos para actualizar." });
      setCsfLoading(false);
      return;
    }

    try {
      await onUpdate(proveedor.id, patch);
      notifySuccess(undefined, { title: "Datos fiscales actualizados desde la CSF" });
    } finally {
      setCsfLoading(false);
    }
  };

  return (
    <>
      <input
        ref={csfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleCsfFile}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={csfLoading}
        onClick={() => csfInputRef.current?.click()}
        title="Actualizar datos fiscales desde la Constancia de Situación Fiscal"
      >
        {csfLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando…</>
        ) : (
          <><Upload className="mr-2 h-4 w-4" /> Actualizar con CSF</>
        )}
      </Button>
    </>
  );
}
