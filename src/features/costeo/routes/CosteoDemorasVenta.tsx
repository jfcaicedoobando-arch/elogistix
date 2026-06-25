/**
 * Tabulador de venta de demoras al cliente.
 * Independiente del tabulador de costo de la naviera.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Timer } from "lucide-react";
import { useDemorasVenta, useDemorasVentaMutations } from "@/features/costeo/hooks/useDemorasVenta";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";

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
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const tipoMap = new Map(tipos.map(t => [t.id, t.code || t.name]));

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!form.tipo_contenedor_id || form.monto_por_dia_usd < 0) return;
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setIntentoEnvio(false);
    setOpen(false);
  };

  const tipoInvalido = intentoEnvio && !form.tipo_contenedor_id;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Tarifa demoras (venta)"
        description="Tabulador escalonado en USD que se le cobra al cliente por días excedidos. Independiente del costo de la naviera."
        actions={<Button onClick={() => { setIntentoEnvio(false); setOpen(true); }}><Plus className="size-4 mr-2" />Nueva tarifa</Button>}
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
                <TableCell className="text-right tabular-nums">
                  {t.hasta_dia ?? <span aria-label="sin límite">∞</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(t.monto_por_dia_usd), 'USD')}</TableCell>
                <TableCell className="text-xs">{formatDate(t.vigente_desde)}</TableCell>
                <TableCell className="text-xs">{t.vigente_hasta ? formatDate(t.vigente_hasta) : '—'}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setAEliminar(t.id)}
                    aria-label="Eliminar tarifa de demoras"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        icon={Timer}
        title="Nueva tarifa de venta"
        description="Define una nueva tarifa de venta por demoras aplicable a los embarques."
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" form="dem-venta-form" disabled={crear.isPending}>Guardar</Button>
          </>
        }
      >
        <form id="dem-venta-form" onSubmit={handleGuardar} className="space-y-3">
          <div>
            <Label htmlFor="dem-tipo">Tipo de contenedor *</Label>
            <Select value={form.tipo_contenedor_id} onValueChange={(v) => setForm({ ...form, tipo_contenedor_id: v })}>
              <SelectTrigger
                id="dem-tipo"
                aria-invalid={tipoInvalido || undefined}
                className={tipoInvalido ? "border-destructive" : undefined}
              >
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.code || t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dem-desde">Desde día</Label>
              <Input id="dem-desde" type="number" min={1} value={form.desde_dia}
                onChange={(e) => setForm({ ...form, desde_dia: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="dem-hasta">Hasta día (vacío = ∞)</Label>
              <Input id="dem-hasta" type="number" value={form.hasta_dia ?? ''}
                onChange={(e) => setForm({ ...form, hasta_dia: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <div>
            <Label htmlFor="dem-monto">Monto por día (USD)</Label>
            <Input id="dem-monto" type="number" step="0.01" min={0} value={form.monto_por_dia_usd}
              onChange={(e) => setForm({ ...form, monto_por_dia_usd: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dem-vig-desde">Vigente desde</Label>
              <DatePickerMx value={form.vigente_desde}
                onChange={(v) => setForm({ ...form, vigente_desde: v })}
                className="w-full" />
            </div>
            <div>
              <Label htmlFor="dem-vig-hasta">Vigente hasta</Label>
              <DatePickerMx value={form.vigente_hasta ?? ''}
                onChange={(v) => setForm({ ...form, vigente_hasta: v || null })}
                className="w-full" />
            </div>
          </div>
        </form>
      </FormDialogShell>

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title="¿Eliminar tarifa de demoras?"
        description="Esta acción no se puede deshacer."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
