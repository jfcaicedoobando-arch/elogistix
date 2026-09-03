/**
 * Bloques fiscales (RFC/Tax ID, país agente, dirección fiscal de gasto).
 * Split de `NuevoProveedorStep1Fields.tsx` para mantener ≤200 líneas.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAISES_PROVEEDOR as PAISES } from "@/constants/proveedorConstants";
import type { Controller } from "./NuevoProveedorStep1Fields";
import { DireccionFiscalFields } from "./DireccionFiscalFields";

export function PaisAgenteSelect({ c }: { c: Controller }) {
  return (
    <div className="space-y-2">
      <Label>País *</Label>
      {/* Elegir país NO borra el RFC/Tax ID: si vino de la CSF debe conservarse. */}
      <Select value={c.form.pais || ""} onValueChange={(v) => c.setField("pais", v)}>
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
      <Label htmlFor="nuevo-proveedor-rfc">{c.rfcLabel} *</Label>
      <Input
        id="nuevo-proveedor-rfc"
        value={c.form.rfc}
        onChange={(e) => c.setField("rfc", e.target.value)}
        placeholder={c.form.origen_proveedor === "Extranjero" ? "Ingresa el Tax ID" : "Ingresa el RFC"}
      />
      {c.rfcDuplicado && (
        <p className="text-body-sm text-warning">
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
  return <DireccionFiscalFields form={c.form} setField={c.setField} regimenRequired />;
}
