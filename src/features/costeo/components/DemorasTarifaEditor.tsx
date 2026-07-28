/**
 * Editor del tabulador escalonado de demoras por tipo de contenedor.
 * Permite agregar/quitar tramos (desde_dia, hasta_dia, monto/día) y guardar.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import {
  useDemorasTramos,
  useReemplazarTramos,
  useTiposContenedorDemoras,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { encontrarSolapeTramos } from "@/features/costeo/utils/demorasTramos";
import { notifyError } from "@/lib/ui/appFeedback";
import type { DemorasTramoInput } from "@/features/costeo/types/navieraCondicion";

interface Props {
  navieraCondicionId: string;
}

interface TramoEditable extends DemorasTramoInput {
  _key: string;
}

const nuevoTramo = (i: number): TramoEditable => ({
  _key: `new-${i}-${Date.now()}`,
  tipo_contenedor_id: "",
  desde_dia: 1,
  hasta_dia: null,
  monto_por_dia: 0,
  moneda: "USD",
});

export function DemorasTarifaEditor({ navieraCondicionId }: Props) {
  const { data: tipos = [] } = useTiposContenedorDemoras();
  const [tipoSel, setTipoSel] = useState<string>("");
  const { data: tramos = [] } = useDemorasTramos(navieraCondicionId);
  const reemplazar = useReemplazarTramos();
  const [rows, setRows] = useState<TramoEditable[]>([]);

  useEffect(() => {
    if (!tipoSel && tipos.length > 0) setTipoSel(tipos[0].id);
  }, [tipoSel, tipos]);

  useEffect(() => {
    const filtered = tramos
      .filter((t) => t.tipo_contenedor_id === tipoSel)
      .map((t, i) => ({
        _key: t.id ?? `t-${i}`,
        tipo_contenedor_id: t.tipo_contenedor_id,
        desde_dia: t.desde_dia,
        hasta_dia: t.hasta_dia,
        monto_por_dia: Number(t.monto_por_dia),
        moneda: t.moneda,
      }));
    setRows(filtered);
  }, [tramos, tipoSel]);

  const update = (key: string, patch: Partial<TramoEditable>) =>
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r._key !== key));
  const add = () => setRows((prev) => [...prev, { ...nuevoTramo(prev.length), tipo_contenedor_id: tipoSel }]);

  const guardar = async () => {
    if (!tipoSel) return;
    // B-096: el motor resuelve solapes en silencio (desde_dia DESC) — la
    // captura debe impedirlos; también rangos invertidos (hasta < desde).
    const solape = encontrarSolapeTramos(rows);
    if (solape) {
      notifyError(undefined, {
        title: solape.invertido
          ? `El tramo ${solape.i} tiene "hasta día" menor que "desde día"`
          : `Los tramos ${solape.i} y ${solape.j} se solapan`,
        description: "Ajusta los rangos para que cada día tenga un solo precio.",
      });
      return;
    }
    const payload: DemorasTramoInput[] = rows.map((r) => ({
      tipo_contenedor_id: tipoSel,
      desde_dia: Number(r.desde_dia) || 1,
      hasta_dia: r.hasta_dia === null ? null : Number(r.hasta_dia),
      monto_por_dia: Number(r.monto_por_dia) || 0,
      moneda: r.moneda || "USD",
    }));
    await reemplazar.mutateAsync({
      navieraCondicionId,
      tipoContenedorId: tipoSel,
      tramos: payload,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-64">
          <Label htmlFor="demoras-tipo" className="sr-only">Tipo de contenedor</Label>
          <Select value={tipoSel} onValueChange={setTipoSel}>
            <SelectTrigger id="demoras-tipo" aria-label="Tipo de contenedor del tabulador">
              <SelectValue placeholder="Tipo de contenedor" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-4 mr-1" /> Tramo
        </Button>
        <Button size="sm" onClick={guardar} disabled={reemplazar.isPending}>
          <Save className="size-4 mr-1" /> Guardar tabulador
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Desde día</TableHead>
            <TableHead className="w-24">Hasta día</TableHead>
            <TableHead className="w-32">Monto/día</TableHead>
            <TableHead className="w-24">Moneda</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin tramos. Agrega uno para iniciar el tabulador.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, idx) => (
            <TableRow key={r._key}>
              <TableCell>
                <Input
                  type="number" min={1} value={r.desde_dia}
                  aria-label={`Desde día del tramo ${idx + 1}`}
                  onChange={(e) => update(r._key, { desde_dia: Number(e.target.value) || 1 })}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number" min={r.desde_dia}
                  placeholder="∞"
                  value={r.hasta_dia ?? ""}
                  aria-label={`Hasta día del tramo ${idx + 1} (vacío para sin límite)`}
                  onChange={(e) =>
                    update(r._key, { hasta_dia: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number" min={0} step="0.01" value={r.monto_por_dia}
                  aria-label={`Monto por día del tramo ${idx + 1}`}
                  onChange={(e) => update(r._key, { monto_por_dia: Number(e.target.value) || 0 })}
                />
              </TableCell>
              <TableCell>
                <Select value={r.moneda} onValueChange={(v) => update(r._key, { moneda: v })}>
                  <SelectTrigger aria-label={`Moneda del tramo ${idx + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(r._key)}
                  aria-label={`Quitar tramo ${idx + 1}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Deja "Hasta día" vacío para indicar "en adelante". Los días se cuentan desde el primer día con cargo.
      </p>
    </div>
  );
}
