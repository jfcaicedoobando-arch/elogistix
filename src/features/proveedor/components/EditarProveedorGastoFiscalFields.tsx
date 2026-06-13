import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import type { useEditarProveedorController } from "@/hooks/proveedor";

type Controller = ReturnType<typeof useEditarProveedorController>;

interface Props {
  c: Controller;
}

export default function EditarProveedorGastoFiscalFields({ c }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Código Postal</Label>
          <Input
            value={c.form.cp ?? ""}
            maxLength={5}
            inputMode="numeric"
            placeholder="64000"
            onChange={(e) => c.setField("cp", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-2">
          <Label>Régimen Fiscal</Label>
          <Select
            value={c.form.regimen_fiscal ?? ""}
            onValueChange={(v) => c.setField("regimen_fiscal", v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
            <SelectContent>
              {REGIMENES_FISCALES_SAT.map((r) => (
                <SelectItem key={r.clave} value={r.clave}>
                  {r.clave} — {r.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Dirección</Label>
        <Input
          value={c.form.direccion ?? ""}
          onChange={(e) => c.setField("direccion", e.target.value)}
          placeholder="Calle, número, colonia"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Ciudad / Municipio</Label>
          <Input
            value={c.form.ciudad ?? ""}
            onChange={(e) => c.setField("ciudad", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input
            value={c.form.estado ?? ""}
            onChange={(e) => c.setField("estado", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
