/**
 * Tabulador de venta de demoras al cliente.
 * Independiente del tabulador de costo de la naviera.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useDemorasVenta, useDemorasVentaMutations } from "@/features/costeo/hooks/useDemorasVenta";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { PageHeader } from "@/components/shared/PageHeader";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: DemoraVentaTarifaInput = {
  tipo_contenedor_id: "",
  desde_dia: 1,
  hasta_dia: null,
  monto_por_dia_usd: 0,
  vigente_desde: today(),
  vigente_hasta: null,
  notas: null,
};

export default function CosteoDemorasVenta() {
  const { data: tarifas = [], isLoading } = useDemorasVenta();
  const { crear, eliminar } = useDemorasVentaMutations();
  const { data: tipos = [] } = useTiposContenedor();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DemoraVentaTarifaInput>(EMPTY);

  const tipoMap = new Map(tipos.map(t => [t.id, t.code || t.name]));

  const handleGuardar = async () => {
    if (!form.tipo_contenedor_id || form.monto_por_dia_usd < 0) return;
    await crear.mutateAsync(form);
    setForm(EMPTY); setOpen(false);
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarifa demoras (venta)"
        description="Tabulador escalonado en USD que se le cobra al cliente por días excedidos. Independiente del costo de la naviera."
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />Nueva tarifa</Button>}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo contenedor</TableHead>
              <TableHead className="text-right">Desde día</TableHead>
              <TableHead className="text-right">Hasta día</TableHead>
              <TableHead className="text-right">Monto/día USD</TableHead>
              <TableHead>Vigente desde</TableHead>
              <TableHead>Vigente hasta</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
            {!isLoading && tarifas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin tarifas. Crea la primera.</TableCell></TableRow>
            )}
            {tarifas.map(t => (
              <TableRow key={t.id}>
                <TableCell>{tipoMap.get(t.tipo_contenedor_id) ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{t.desde_dia}</TableCell>
                <TableCell className="text-right tabular-nums">{t.hasta_dia ?? '∞'}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(t.monto_por_dia_usd), 'USD')}</TableCell>
                <TableCell className="text-xs">{formatDate(t.vigente_desde)}</TableCell>
                <TableCell className="text-xs">{t.vigente_hasta ? formatDate(t.vigente_hasta) : '—'}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => eliminar.mutate(t.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva tarifa de venta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de contenedor</Label>
              <Select value={form.tipo_contenedor_id} onValueChange={(v) => setForm({ ...form, tipo_contenedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.code || t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde día</Label>
                <Input type="number" min={1} value={form.desde_dia}
                  onChange={(e) => setForm({ ...form, desde_dia: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Hasta día (vacío = ∞)</Label>
                <Input type="number" value={form.hasta_dia ?? ''}
                  onChange={(e) => setForm({ ...form, hasta_dia: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <Label>Monto por día (USD)</Label>
              <Input type="number" step="0.01" min={0} value={form.monto_por_dia_usd}
                onChange={(e) => setForm({ ...form, monto_por_dia_usd: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vigente desde</Label>
                <Input type="date" value={form.vigente_desde}
                  onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })} />
              </div>
              <div>
                <Label>Vigente hasta</Label>
                <Input type="date" value={form.vigente_hasta ?? ''}
                  onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value || null })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={!form.tipo_contenedor_id || crear.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
