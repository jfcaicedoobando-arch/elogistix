/**
 * Tabulador de venta de demoras al cliente.
 * Independiente del tabulador de costo de la naviera.
 * Oleada 4: migrado a PageContainer + ListSkeleton compartidos.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useDemorasVenta, useDemorasVentaMutations } from "@/features/costeo/hooks/useDemorasVenta";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { NuevaTarifaDemoraDialog } from "@/features/costeo/components/NuevaTarifaDemoraDialog";

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

  const tipoMap = new Map(tipos.map((t) => [t.id, t.code || t.name]));

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
    <PageContainer>
      <PageHeader
        title="Tarifa demoras (venta)"
        description="Tabulador escalonado en USD que se le cobra al cliente por días excedidos. Independiente del costo de la naviera."
        actions={
          <Button onClick={() => { setIntentoEnvio(false); setOpen(true); }}>
            <Plus className="size-4 mr-2" />Nueva tarifa
          </Button>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={5} variant="table" />
      ) : (
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
              {tarifas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Sin tarifas. Crea la primera.
                  </TableCell>
                </TableRow>
              )}
              {tarifas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{tipoMap.get(t.tipo_contenedor_id) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.desde_dia}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.hasta_dia ?? <span aria-label="sin límite">∞</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(Number(t.monto_por_dia_usd), "USD")}
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(t.vigente_desde)}</TableCell>
                  <TableCell className="text-xs">
                    {t.vigente_hasta ? formatDate(t.vigente_hasta) : "—"}
                  </TableCell>
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
      )}

      <NuevaTarifaDemoraDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
        tipos={tipos}
        isPending={crear.isPending}
        tipoInvalido={tipoInvalido}
        onSubmit={handleGuardar}
      />

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
    </PageContainer>
  );
}
