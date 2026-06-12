import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANCOS_MEXICO } from "@/constants/bancosMexico";
import type { useNuevoProveedorController } from "@/hooks/proveedor";

type Controller = ReturnType<typeof useNuevoProveedorController>;

/**
 * Paso 2 del wizard de Nuevo Proveedor: datos bancarios opcionales (banco + CLABE).
 */
export function NuevoProveedorStep2({ c }: { c: Controller }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Datos bancarios</h3>
        <p className="text-xs text-muted-foreground">
          Opcional. Puedes capturarlos después desde la edición del proveedor.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Banco</Label>
        <Select value={c.form.banco || undefined} onValueChange={(v) => c.setField("banco", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_MEXICO.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>CLABE interbancaria</Label>
        <Input
          inputMode="numeric"
          maxLength={18}
          placeholder="18 dígitos"
          value={c.form.clabe}
          onChange={(e) => c.setField("clabe", e.target.value.replace(/\D/g, ""))}
        />
        {c.form.clabe.length > 0 && c.form.clabe.length !== 18 && (
          <p className="text-xs text-destructive">
            La CLABE debe tener 18 dígitos ({c.form.clabe.length}/18).
          </p>
        )}
      </div>
    </div>
  );
}
