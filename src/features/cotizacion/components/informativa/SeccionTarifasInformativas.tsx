/**
 * Editor de filas de tarifa para una cotización informativa.
 * Cada fila representa un servicio (ruta + modo + precio) con vigencia global.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { MODOS } from "@/constants/wizardConstants";
import {
  MODALIDADES_EQUIPO_TERRESTRE,
} from "@/constants/cotizacionTerrestre";
import { MONEDAS_TARIFARIO, UNIDADES_MEDIDA_TARIFARIO } from "@/constants/cotizacionInformativa";
import {
  nuevaTarifaInformativa,
  type TarifaInformativa,
} from "@/features/cotizacion/types";

interface Props {
  tarifas: TarifaInformativa[];
  onChange: (next: TarifaInformativa[]) => void;
}

export default function SeccionTarifasInformativas({ tarifas, onChange }: Props) {
  const update = (idx: number, patch: Partial<TarifaInformativa>) => {
    onChange(tarifas.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };
  const remove = (idx: number) => onChange(tarifas.filter((_, i) => i !== idx));
  const add = () => onChange([...tarifas, nuevaTarifaInformativa()]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Tarifas ({tarifas.length})</h3>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Agregar tarifa
        </Button>
      </div>

      <div className="space-y-3">
        {tarifas.map((t, idx) => {
          const esTerrestre = t.modo === "Terrestre";
          const esPortaCont = esTerrestre && t.modalidad_equipo === "Porta Contenedor";
          return (
            <div key={t.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Modo</label>
                  <Select value={t.modo} onValueChange={(v) => update(idx, { modo: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {esTerrestre && (
                  <div className="col-span-12 md:col-span-3">
                    <label className="text-xs text-muted-foreground">Modalidad</label>
                    <Select value={t.modalidad_equipo || ""} onValueChange={(v) => update(idx, { modalidad_equipo: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {MODALIDADES_EQUIPO_TERRESTRE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-12 md:col-span-3">
                  <label className="text-xs text-muted-foreground">Origen</label>
                  <Input value={t.origen} onChange={(e) => update(idx, { origen: e.target.value })} className="h-9" />
                </div>
                {esPortaCont && (
                  <div className="col-span-12 md:col-span-2">
                    <label className="text-xs text-muted-foreground">Carga/Descarga</label>
                    <Input value={t.punto_intermedio || ""} onChange={(e) => update(idx, { punto_intermedio: e.target.value })} className="h-9" />
                  </div>
                )}
                <div className="col-span-12 md:col-span-3">
                  <label className="text-xs text-muted-foreground">Destino</label>
                  <Input value={t.destino} onChange={(e) => update(idx, { destino: e.target.value })} className="h-9" />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Unidad</label>
                  <Select value={t.unidad_medida} onValueChange={(v) => update(idx, { unidad_medida: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES_MEDIDA_TARIFARIO.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Precio</label>
                  <Input type="number" min={0} step="0.01" value={t.precio} onChange={(e) => update(idx, { precio: parseFloat(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Moneda</label>
                  <Select value={t.moneda} onValueChange={(v) => update(idx, { moneda: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONEDAS_TARIFARIO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-5">
                  <label className="text-xs text-muted-foreground">Notas</label>
                  <Input value={t.notas || ""} onChange={(e) => update(idx, { notas: e.target.value })} className="h-9" placeholder="Observaciones de esta tarifa" />
                </div>
                <div className="col-span-12 md:col-span-1 flex md:items-end justify-end">
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(idx)} disabled={tarifas.length <= 1} aria-label="Eliminar fila">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {tarifas.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
            No hay tarifas. Agrega al menos una.
          </div>
        )}
      </div>
    </div>
  );
}
