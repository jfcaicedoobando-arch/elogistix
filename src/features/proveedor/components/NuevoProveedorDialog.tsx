/**
 * Modal "Nuevo Proveedor" — wizard 2 pasos sobre `FormDialogShell`.
 * El render de cada paso vive en `NuevoProveedorStep1` / `NuevoProveedorStep2`
 * (mantenidos así para respetar el límite de 200 líneas Power-of-10).
 */
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import type { TablesInsert } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useNuevoProveedorController } from "@/features/proveedor/hooks";
import type { PrefillProveedor } from "@/features/proveedor/hooks/useNuevoProveedorController.prefill";
import { NuevoProveedorStep1 } from "./NuevoProveedorStep1";
import { NuevoProveedorStep2 } from "./NuevoProveedorStep2";
import { FaltantesHint } from "@/features/facturacion/components/FaltantesHint";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TablesInsert<"proveedores">) => void;
  /** Prellenado opcional (datos detectados en una factura de proveedor). */
  prefill?: PrefillProveedor;
}

export default function NuevoProveedorDialog({ open, onOpenChange, onSave, prefill }: Props) {
  const c = useNuevoProveedorController(onSave, () => onOpenChange(false), prefill);

  const origen = c.form.origen_proveedor;
  const headerAside = origen ? (
    <Badge variant={origen === "Nacional" ? "secondary" : "outline"} className="text-label font-medium">
      {origen}
    </Badge>
  ) : undefined;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(abierto) => { if (!abierto) c.resetAndClose(); else onOpenChange(abierto); }}
      icon={Building2}
      title="Nuevo proveedor"
      description={
        c.step === 1
          ? "Identifica al proveedor y captura sus datos fiscales y de contacto."
          : "Datos bancarios (opcionales). Puedes capturarlos después desde la edición del proveedor."
      }
      size="xl"
      stepper={{ step: c.step, totalSteps: 2, labels: ["Identificación", "Datos bancarios"] }}
      headerAside={headerAside}
      // YG-04: con datos capturados, cerrar por X/Escape/clic exterior pide confirmación.
      isDirty={c.isDirty}
      footer={c.step === 1 ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          {!c.isStep1Valid && <FaltantesHint items={c.faltantesStep1} className="mr-auto" />}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={c.resetAndClose}>Cancelar</Button>
            <Button onClick={c.handleNext} disabled={!c.isStep1Valid}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button variant="outline" onClick={() => c.setStep(1)} disabled={c.saving}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
          </Button>
          <Button onClick={c.handleSave} loading={c.saving}>
            {c.saving ? "Guardando…" : "Crear proveedor"}
          </Button>
        </>
      )}
    >
      {c.step === 1 && <NuevoProveedorStep1 c={c} />}
      {c.step === 2 && <NuevoProveedorStep2 c={c} />}
    </FormDialogShell>
  );
}
