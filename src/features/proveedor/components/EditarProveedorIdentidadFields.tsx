/**
 * Campos de identidad fiscal del proveedor (origen, nombre, tipo, subtipo de
 * gasto, país y RFC/Tax ID) extraídos de EditarProveedorDialog.tsx.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PAISES_PROVEEDOR as PAISES,
  SUBTIPOS_GASTO_OPERATIVO,
  tiposProveedorPorOrigen,
} from "@/constants/proveedorConstants";
import type { useEditarProveedorController } from "@/features/proveedor/hooks";
import { FieldError } from "./EditarProveedorFieldError";

interface Props {
  c: ReturnType<typeof useEditarProveedorController>;
}

export default function EditarProveedorIdentidadFields({ c }: Props) {
  return (
    <>
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
    </>
  );
}
