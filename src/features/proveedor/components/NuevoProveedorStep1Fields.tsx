/**
 * Bloques generales del Paso 1: categoría, origen, CSF, tipo/subtipo y contacto.
 * Bloques fiscales (RFC, país, dirección de gasto) viven en
 * `NuevoProveedorStep1FiscalFields.tsx`. Split para cumplir Power-of-10.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { useRef } from "react";
import {
  MONEDAS_PROVEEDOR as MONEDAS,
  SUBTIPOS_GASTO_OPERATIVO,
  tiposProveedorPorOrigen,
} from "@/constants/proveedorConstants";
import type { Enums } from "@/types/db";
import type { useNuevoProveedorController } from "@/features/proveedor/hooks";

export type Controller = ReturnType<typeof useNuevoProveedorController>;


export function OrigenSelect({ c }: { c: Controller }) {
  return (
    <div className="space-y-2">
      <Label>Origen *</Label>
      <Select value={c.form.origen_proveedor || ""} onValueChange={(v) => c.setField("origen_proveedor", v as "Nacional" | "Extranjero")}>
        <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Nacional">Nacional</SelectItem>
          <SelectItem value="Extranjero">Extranjero</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function CsfUploader({ c }: { c: Controller }) {
  const csfInputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void c.handleCsfUpload(file);
    e.target.value = "";
  };
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/40 p-3">
      <Label className="text-sm">Cargar Constancia de Situación Fiscal (PDF)</Label>
      <p className="text-xs text-muted-foreground">
        Opcional. Extraemos automáticamente nombre y RFC desde la CSF del SAT.
      </p>
      <input ref={csfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onChange} />
      <Button type="button" variant="outline" size="sm" disabled={c.csfLoading} onClick={() => csfInputRef.current?.click()}>
        {c.csfLoading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" /> Subir CSF</>
        )}
      </Button>
    </div>
  );
}

export function TipoLogisticoSelect({ c }: { c: Controller }) {
  const tipos = tiposProveedorPorOrigen(c.form.origen_proveedor, c.form.tipo);
  return (
    <div className="space-y-2">
      <Label>Tipo *</Label>
      <Select value={c.form.tipo ?? ""} onValueChange={c.handleTipoChange}>
        <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
        <SelectContent>
          {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SubtipoGastoSelect({ c }: { c: Controller }) {
  return (
    <div className="space-y-2">
      <Label>Subtipo de gasto *</Label>
      <Select value={c.form.subtipo_gasto ?? ""} onValueChange={c.handleSubtipoGastoChange}>
        <SelectTrigger><SelectValue placeholder="Selecciona subtipo" /></SelectTrigger>
        <SelectContent>
          {SUBTIPOS_GASTO_OPERATIVO.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ContactoFields({ c }: { c: Controller }) {
  return (
    <>
      <div className="space-y-2">
        <Label>Contacto</Label>
        <Input value={c.form.contacto} onChange={(e) => c.setField("contacto", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={c.form.email} onChange={(e) => c.setField("email", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Teléfono</Label>
        <Input value={c.form.telefono} onChange={(e) => c.setField("telefono", e.target.value)} />
      </div>
      {!c.isGasto && (
        <div className="space-y-2">
          <Label>Moneda Preferida</Label>
          <Select value={c.form.moneda_preferida} onValueChange={(v) => c.setField("moneda_preferida", v as Enums<"moneda">)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* v13.315.8 (QW2) — días de crédito por defecto que se heredarán a las facturas. */}
      <div className="space-y-2">
        <Label>Días de crédito</Label>
        <Input
          type="number"
          min={0}
          value={c.form.dias_credito ?? 0}
          onChange={(e) => c.setField("dias_credito", Number(e.target.value) || 0)}
        />
      </div>
    </>
  );
}
