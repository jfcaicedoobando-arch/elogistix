/**
 * Formulario de condiciones por naviera (carta garantía + días libres).
 * Vínculo obligatorio a proveedor tipo "Naviera".
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type {
  CosteoNavieraCondicion,
  NavieraCondicionInput,
} from "@/features/costeo/types/navieraCondicion";

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

export function NavieraCondicionForm({ navieraId, navieraNombre, existente, onSaved }: Props) {
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

  const valido =
    !!form.proveedor_id &&
    (!form.tiene_carta_garantia || !!form.carta_garantia_vigente_hasta);

  const submit = async () => {
    if (!valido) return;
    await guardar.mutateAsync({ input: form, id: existente?.id });
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Naviera</p>
        <p className="font-medium">{navieraNombre}</p>
      </div>

      <div>
        <Label>Proveedor vinculado *</Label>
        <Select value={form.proveedor_id} onValueChange={(v) => setForm({ ...form, proveedor_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona proveedor tipo 'Naviera'" /></SelectTrigger>
          <SelectContent>
            {proveedores.length === 0 && (
              <SelectItem value="__empty" disabled>
                Sin proveedores tipo "Naviera". Créalos en Directorio → Proveedores.
              </SelectItem>
            )}
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Switch
            id="carta"
            checked={form.tiene_carta_garantia}
            onCheckedChange={(v) => setForm({ ...form, tiene_carta_garantia: v })}
          />
          <Label htmlFor="carta">Carta Garantía vigente (sustituye depósito de contenedor)</Label>
        </div>
        {form.tiene_carta_garantia && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vigente hasta *</Label>
              <Input
                type="date"
                value={form.carta_garantia_vigente_hasta ?? ""}
                onChange={(e) =>
                  setForm({ ...form, carta_garantia_vigente_hasta: e.target.value || null })
                }
              />
            </div>
            <div>
              <Label>Folio / referencia</Label>
              <Input
                value={form.carta_garantia_folio ?? ""}
                onChange={(e) => setForm({ ...form, carta_garantia_folio: e.target.value || null })}
              />
            </div>
            <div className="col-span-2">
              <Label>Notas de la carta</Label>
              <Textarea
                rows={2}
                value={form.carta_garantia_notas ?? ""}
                onChange={(e) => setForm({ ...form, carta_garantia_notas: e.target.value || null })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Días libres de demoras (estándar)</Label>
          <Input
            type="number"
            min={0}
            value={form.dias_libres_demoras_default}
            onChange={(e) =>
              setForm({ ...form, dias_libres_demoras_default: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label>Moneda de demoras</Label>
          <Select
            value={form.moneda_demoras}
            onValueChange={(v) => setForm({ ...form, moneda_demoras: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notas generales</Label>
        <Textarea
          rows={2}
          value={form.notas ?? ""}
          onChange={(e) => setForm({ ...form, notas: e.target.value || null })}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!valido || guardar.isPending}>
          {existente ? "Actualizar" : "Crear"} condiciones
        </Button>
      </div>
    </div>
  );
}
