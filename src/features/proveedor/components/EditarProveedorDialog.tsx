import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Enums, Tables, TablesUpdate } from "@/types/db";
import {
  MONEDAS_PROVEEDOR as MONEDAS,
  PAISES_PROVEEDOR as PAISES,
  SUBTIPOS_GASTO_OPERATIVO,
  tiposProveedorPorOrigen,
} from "@/constants/proveedorConstants";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useEditarProveedorController } from "@/features/proveedor/hooks";
import EditarProveedorGastoFiscalFields from "./EditarProveedorGastoFiscalFields";
import EditarProveedorBancariosFields from "./EditarProveedorBancariosFields";

type Proveedor = Tables<"proveedores">;
type Moneda = Enums<"moneda">;

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    data: TablesUpdate<"proveedores">,
    expectedUpdatedAt?: string | null,
    organizationId?: string | null,
  ) => Promise<unknown>;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-body text-destructive">{message}</p>;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const c = useEditarProveedorController(proveedor, open, onSave, () => onOpenChange(false));

  const origen = c.form.origen_proveedor;
  const headerAside = origen ? (
    <Badge variant={origen === "Nacional" ? "secondary" : "outline"} className="text-label font-medium">
      {origen}
    </Badge>
  ) : undefined;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title="Editar proveedor"
      description="Modifica la información fiscal y de contacto del proveedor."
      size="xl"
      headerAside={headerAside}
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={c.handleSave} disabled={!c.isValid || c.isSaving}>
            {c.isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </>
      )}
    >
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
          <Label htmlFor="editar-proveedor-nombre">Nombre *</Label>
          <Input
            id="editar-proveedor-nombre"
            value={c.form.nombre}
            onChange={(e) => c.setField("nombre", e.target.value.toLocaleUpperCase("es-MX"))}
            onBlur={() => c.markTouched("nombre")}
          />
          <FieldError message={c.fieldErrorMessage("nombre")} />
        </div>

        {c.isLogistico && c.form.origen_proveedor === "Extranjero" && (
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={c.form.tipo ?? ""} onValueChange={c.handleTipoChange}>
              <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
              <SelectContent>
                {tiposProveedorPorOrigen(c.form.origen_proveedor, c.form.tipo).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={c.fieldErrorMessage("tipo")} />
          </div>
        )}

        {c.isGasto && (
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
            <FieldError message={c.fieldErrorMessage("subtipo_gasto")} />
          </div>
        )}

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
            <Label htmlFor="editar-proveedor-rfc">{c.rfcLabel} *</Label>
            <Input
              id="editar-proveedor-rfc"
              value={c.form.rfc}
              onChange={(e) => c.setField("rfc", e.target.value)}
              onBlur={() => c.markTouched("rfc")}
              placeholder={c.form.origen_proveedor === "Extranjero" ? "Ingresa el Tax ID" : "Ingresa el RFC"}
            />
            <FieldError message={c.fieldErrorMessage("rfc")} />
          </div>
        )}

        {c.isGasto && <EditarProveedorGastoFiscalFields c={c} />}

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

        <EditarProveedorBancariosFields c={c} />
      </div>
    </FormDialogShell>
  );
}
