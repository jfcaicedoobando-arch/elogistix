/**
 * Bloques fiscales (RFC/Tax ID, país agente, dirección fiscal de gasto).
 * Split de `NuevoProveedorStep1Fields.tsx` para mantener ≤200 líneas.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAISES_PROVEEDOR as PAISES } from "@/constants/proveedorConstants";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import type { Controller } from "./NuevoProveedorStep1Fields";

export function PaisAgenteSelect({ c }: { c: Controller }) {
  return (
    <div className="space-y-2">
      <Label>País *</Label>
      <Select value={c.form.pais || ""} onValueChange={(v) => { c.setField("pais", v); c.setField("rfc", ""); }}>
        <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
        <SelectContent>
          {PAISES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RfcField({ c }: { c: Controller }) {
  return (
    <div className="space-y-2">
      <Label>{c.rfcLabel} *</Label>
      <Input
        value={c.form.rfc}
        onChange={(e) => c.setField("rfc", e.target.value)}
        placeholder={c.form.origen_proveedor === "Extranjero" ? "Ingresa el Tax ID" : "Ingresa el RFC"}
      />
      {c.rfcDuplicado && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Ya existe un proveedor con este {c.rfcLabel}:{" "}
          <a href={`/proveedores/${c.rfcDuplicado.id}`} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            {c.rfcDuplicado.nombre}
          </a>
          . No podrás guardar un duplicado.
        </p>
      )}
    </div>
  );
}

export function DireccionFiscalGastoFields({ c }: { c: Controller }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Código Postal</Label>
          <Input
            value={c.form.cp}
            maxLength={5}
            inputMode="numeric"
            placeholder="64000"
            onChange={(e) => c.setField("cp", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-2">
          <Label>Régimen Fiscal *</Label>
          <Select value={c.form.regimen_fiscal || ""} onValueChange={(v) => c.setField("regimen_fiscal", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
            <SelectContent>
              {REGIMENES_FISCALES_SAT.map((r) => (
                <SelectItem key={r.clave} value={r.clave}>{r.clave} — {r.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Dirección</Label>
        <Input value={c.form.direccion} onChange={(e) => c.setField("direccion", e.target.value)} placeholder="Calle, número, colonia" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Ciudad / Municipio</Label>
          <Input value={c.form.ciudad} onChange={(e) => c.setField("ciudad", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input value={c.form.estado} onChange={(e) => c.setField("estado", e.target.value)} />
        </div>
      </div>
    </>
  );
}
