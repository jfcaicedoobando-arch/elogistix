/**
 * Formulario de condiciones por naviera (carta garantía + días libres).
 * Vínculo obligatorio a proveedor tipo "Naviera".
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useCondicionNavieraMutations,
  useProveedoresNaviera,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import type { ProveedorOpcion } from "@/features/costeo/services/agentes";
import type {
  CosteoNavieraCondicion,
  NavieraCondicionInput,
} from "@/features/costeo/types/navieraCondicion";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import { NavieraProveedorAlerta } from "@/features/costeo/components/NavieraProveedorAlerta";

interface Props {
  navieraId: string;
  navieraNombre: string;
  existente: CosteoNavieraCondicion | null;
  onSaved: () => void;
}

const empty = (navieraId: string): NavieraCondicionInput => ({
  naviera_id: navieraId,
  proveedor_id: "",
  tiene_carta_garantia: false,
  carta_garantia_vigente_hasta: null,
  carta_garantia_folio: null,
  carta_garantia_notas: null,
  dias_libres_demoras_default: 0,
  moneda_demoras: "USD",
  notas: null,
});

export function NavieraCondicionForm({ navieraId, existente, onSaved }: Props) {
  const { data: proveedores = [] } = useProveedoresNaviera();
  const { guardar } = useCondicionNavieraMutations();
  const [form, setForm] = useState<NavieraCondicionInput>(empty(navieraId));

  useEffect(() => {
    if (existente) {
      setForm({
        naviera_id: existente.naviera_id,
        proveedor_id: existente.proveedor_id,
        tiene_carta_garantia: existente.tiene_carta_garantia,
        carta_garantia_vigente_hasta: existente.carta_garantia_vigente_hasta,
        carta_garantia_folio: existente.carta_garantia_folio,
        carta_garantia_notas: existente.carta_garantia_notas,
        dias_libres_demoras_default: existente.dias_libres_demoras_default,
        moneda_demoras: existente.moneda_demoras,
        notas: existente.notas,
      });
    } else {
      setForm(empty(navieraId));
    }
  }, [existente, navieraId]);

  // P2 (auditoría v13.823.143 · bug 4): sin proveedor tipo "Naviera" vinculado
  // no se puede guardar nada; los campos quedan deshabilitados para no invitar
  // a capturar datos que se perderían.
  const sinProveedor = proveedores.length === 0;

  const valido =
    !sinProveedor &&
    !!form.proveedor_id &&
    (!form.tiene_carta_garantia || !!form.carta_garantia_vigente_hasta);

  const submit = async () => {
    if (!valido) return;
    await guardar.mutateAsync({ input: form, id: existente?.id });
    onSaved();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="space-y-4"
    >
      {proveedores.length === 0 ? (
        <NavieraProveedorAlerta />
      ) : (
        <div>
          <Label htmlFor="nav-proveedor">Proveedor vinculado *</Label>
          <Select value={form.proveedor_id} onValueChange={(v) => setForm({ ...form, proveedor_id: v })}>
            <SelectTrigger id="nav-proveedor"><SelectValue placeholder="Selecciona proveedor tipo 'Naviera'" /></SelectTrigger>
            <SelectContent>
              {(proveedores as ProveedorOpcion[]).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <fieldset disabled={sinProveedor} className="space-y-4 disabled:opacity-60">
      {sinProveedor && (
        <p className="text-body-sm text-muted-foreground">
          Vincula primero un proveedor tipo &quot;Naviera&quot; para capturar carta garantía y demoras.
        </p>
      )}
      <fieldset className="rounded-md border p-3 space-y-3">
        <legend className="text-body font-medium px-1">Carta Garantía</legend>
        <div className="flex items-center gap-2">
          <Switch
            id="carta"
            checked={form.tiene_carta_garantia}
            onCheckedChange={(v) => setForm({ ...form, tiene_carta_garantia: v })}
          />
          <Label htmlFor="carta">Carta Garantía vigente (sustituye depósito de contenedor)</Label>
        </div>
        {form.tiene_carta_garantia && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="carta-vigente">{rangoLabel("Vigencia", "hasta")} *</Label>
              <DatePickerMx
                value={form.carta_garantia_vigente_hasta ?? ""}
                onChange={(v) =>
                  setForm({ ...form, carta_garantia_vigente_hasta: v || null })
                }
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="carta-folio">Folio / referencia</Label>
              <Input
                id="carta-folio"
                value={form.carta_garantia_folio ?? ""}
                onChange={(e) => setForm({ ...form, carta_garantia_folio: e.target.value || null })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="carta-notas">Notas de la carta</Label>
              <Textarea
                id="carta-notas"
                rows={2}
                value={form.carta_garantia_notas ?? ""}
                onChange={(e) => setForm({ ...form, carta_garantia_notas: e.target.value || null })}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="nav-dias-libres">Días libres de demoras (estándar)</Label>
          <Input
            id="nav-dias-libres"
            type="number"
            min={0}
            value={form.dias_libres_demoras_default}
            onChange={(e) =>
              setForm({ ...form, dias_libres_demoras_default: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="nav-moneda">Moneda de demoras</Label>
          <Select
            value={form.moneda_demoras}
            onValueChange={(v) => setForm({ ...form, moneda_demoras: v })}
          >
            <SelectTrigger id="nav-moneda"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="nav-notas">Notas generales</Label>
        <Textarea
          id="nav-notas"
          rows={2}
          value={form.notas ?? ""}
          onChange={(e) => setForm({ ...form, notas: e.target.value || null })}
        />
      </div>

      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={!valido || guardar.isPending}>
          {existente ? "Actualizar" : "Crear"} condiciones
        </Button>
      </div>
    </form>
  );
}
