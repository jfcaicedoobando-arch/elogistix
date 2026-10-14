/**
 * Paso posterior a la carga: el usuario elige qué puertos/navieras del correo
 * (no dados de alta) quiere registrar en el catálogo, con código y país.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { insertNaviera, insertPuerto } from "@/features/catalogos/services";

interface Props { puertos: string[]; navieras: string[]; onAltas: (creadas: number) => void }
interface Item { tipo: "puerto" | "naviera"; nombre: string; sel: boolean; code: string; country: string }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

export function AltaFaltantesPanel({ puertos, navieras, onAltas }: Props) {
  const [items, setItems] = useState<Item[]>(() => [
    ...puertos.map((n): Item => ({ tipo: "puerto", nombre: n, sel: false, code: "", country: "China" })),
    ...navieras.map((n): Item => ({ tipo: "naviera", nombre: n, sel: false, code: n.toUpperCase(), country: "" })),
  ]);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const set = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const elegidos = items.filter((x) => x.sel);
  const incompleto = elegidos.some((x) => !x.code.trim() || (x.tipo === "puerto" && !x.country.trim()));

  const darAlta = async () => {
    setGuardando(true);
    const errs: string[] = [];
    let creadas = 0;
    for (const x of elegidos) {
      try {
        if (x.tipo === "puerto") await insertPuerto({ name: x.nombre, code: x.code.trim().toUpperCase(), country: x.country.trim() });
        else await insertNaviera({ name: x.nombre, code: x.code.trim().toUpperCase() });
        creadas += 1;
      } catch (e) { errs.push(`${x.nombre}: ${msg(e)}`); }
    }
    setErrores(errs); setGuardando(false);
    if (creadas > 0) onAltas(creadas);
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">Estos puertos o navieras del correo no están dados de alta. Marca los que quieras registrar:</p>
      <ul className="max-h-64 space-y-2 overflow-auto">
        {items.map((x, i) => (
          <li key={`${x.tipo}-${x.nombre}`} className="flex flex-wrap items-center gap-2">
            <Checkbox checked={x.sel} onCheckedChange={(v) => set(i, { sel: v === true })} aria-label={`Dar de alta ${x.nombre}`} />
            <span className="min-w-[160px]">{x.tipo === "puerto" ? "Puerto" : "Naviera"}: <strong>{x.nombre}</strong></span>
            <Input className="h-8 w-32" placeholder={x.tipo === "puerto" ? "Código (CNLYG)" : "Código"} value={x.code}
              onChange={(e) => set(i, { code: e.target.value })} disabled={!x.sel} />
            {x.tipo === "puerto" && (
              <Input className="h-8 w-32" placeholder="País" value={x.country} onChange={(e) => set(i, { country: e.target.value })} disabled={!x.sel} />
            )}
          </li>
        ))}
      </ul>
      {errores.length > 0 && <ul className="list-disc pl-5 text-destructive">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      <Button size="sm" onClick={() => void darAlta()} disabled={guardando || elegidos.length === 0 || incompleto}>
        {guardando ? "Dando de alta…" : `Dar de alta ${elegidos.length} seleccionado(s)`}
      </Button>
    </div>
  );
}
