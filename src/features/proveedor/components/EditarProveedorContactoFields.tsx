/**
 * Campos de contacto, moneda preferida y días de crédito del proveedor,
 * extraídos de EditarProveedorDialog.tsx.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Enums } from "@/types/db";
import { MONEDAS_PROVEEDOR as MONEDAS } from "@/constants/proveedorConstants";
import type { useEditarProveedorController } from "@/features/proveedor/hooks";
import { FieldError } from "./EditarProveedorFieldError";

type Moneda = Enums<"moneda">;

interface Props {
  c: ReturnType<typeof useEditarProveedorController>;
}

export default function EditarProveedorContactoFields({ c }: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="editar-proveedor-contacto">Contacto</Label>
        <Input id="editar-proveedor-contacto" value={c.form.contacto} onChange={(e) => c.setField("contacto", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="editar-proveedor-email">Email</Label>
        <Input
          id="editar-proveedor-email"
          type="email"
          value={c.form.email}
          onChange={(e) => c.setField("email", e.target.value)}
          onBlur={() => c.markTouched("email")}
        />
        <FieldError message={c.fieldErrorMessage("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="editar-proveedor-telefono">Teléfono</Label>
        <Input id="editar-proveedor-telefono" value={c.form.telefono} onChange={(e) => c.setField("telefono", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Moneda Preferida</Label>
        <Select value={c.form.moneda_preferida} onValueChange={(v) => c.setField("moneda_preferida", v as Moneda)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* v13.315.8 (QW2) — días de crédito por defecto para facturas de este proveedor. */}
      <div className="space-y-2">
        <Label htmlFor="editar-proveedor-dias-credito">Días de crédito</Label>
        <Input
          id="editar-proveedor-dias-credito"
          type="number"
          min={0}
          value={c.form.dias_credito ?? 0}
          onChange={(e) => c.setField("dias_credito", Number(e.target.value) || 0)}
        />
      </div>
    </>
  );
}
