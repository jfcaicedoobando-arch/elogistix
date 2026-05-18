import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Enums, Tables, TablesUpdate } from "@/types/db";
import {
  TIPOS_PROVEEDOR as TIPOS,
  MONEDAS_PROVEEDOR as MONEDAS,
  PAISES_PROVEEDOR as PAISES,
} from "@/constants/proveedorConstants";
import { useEditarProveedorController } from "@/hooks/proveedor";

type Proveedor = Tables<"proveedores">;
type Moneda = Enums<"moneda">;

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: TablesUpdate<"proveedores">) => void;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const c = useEditarProveedorController(proveedor, open, onSave, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Editar Proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origen *</Label>
            <Select
              value={c.form.origen_proveedor || ""}
              onValueChange={(v) => { c.setField("origen_proveedor", v as "Nacional" | "Extranjero"); c.markTouched("origen_proveedor"); }}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Extranjero">Extranjero</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={c.fieldErrorMessage("origen_proveedor")} />
          </div>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={c.form.nombre}
              onChange={(e) => c.setField("nombre", e.target.value)}
              onBlur={() => c.markTouched("nombre")}
            />
            <FieldError message={c.fieldErrorMessage("nombre")} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={c.form.tipo} onValueChange={c.handleTipoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {c.isAgenteCarga && (
            <div className="space-y-2">
              <Label>País *</Label>
              <Select
                value={c.form.pais || ""}
                onValueChange={(v) => { c.setField("pais", v); c.setField("rfc", ""); c.markTouched("pais"); }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                <SelectContent>
                  {PAISES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={c.fieldErrorMessage("pais")} />
            </div>
          )}

          {(!c.isAgenteCarga || c.form.pais) && (
            <div className="space-y-2">
              <Label>{c.rfcLabel} *</Label>
              <Input
                value={c.form.rfc}
                onChange={(e) => c.setField("rfc", e.target.value)}
                onBlur={() => c.markTouched("rfc")}
                placeholder={c.form.origen_proveedor === "Extranjero" ? "Ingresa el Tax ID" : "Ingresa el RFC"}
              />
              <FieldError message={c.fieldErrorMessage("rfc")} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input value={c.form.contacto} onChange={(e) => c.setField("contacto", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={c.form.email}
              onChange={(e) => c.setField("email", e.target.value)}
              onBlur={() => c.markTouched("email")}
            />
            <FieldError message={c.fieldErrorMessage("email")} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={c.form.telefono} onChange={(e) => c.setField("telefono", e.target.value)} />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={c.handleSave} disabled={!c.isValid}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
