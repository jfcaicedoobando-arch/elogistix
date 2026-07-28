/**
 * Tabulador de venta de demoras al cliente.
 * v13.172.16: migrado de `<Table>` crudo a `DataTable` para unificar look & feel.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { Plus, Trash2 } from "lucide-react";
import { useDemorasVenta, useDemorasVentaMutations } from "@/features/costeo/hooks/useDemorasVenta";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { tramosSeSolapan, vigenciasSeSolapan } from "@/features/costeo/utils/demorasTramos";
import { notifyError } from "@/lib/ui/appFeedback";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { NuevaTarifaDemoraDialog } from "@/features/costeo/components/NuevaTarifaDemoraDialog";
import { todayLocalISO } from "@/lib/date/today";

const today = () => todayLocalISO();
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

  type Tarifa = (typeof tarifas)[number];
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t.code || t.name])), [tipos]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!form.tipo_contenedor_id || form.monto_por_dia_usd < 0) return;
    // B-096: impedir tramos solapados con los vigentes del mismo contenedor.
    const solapada = tarifas.find((t) =>
      t.tipo_contenedor_id === form.tipo_contenedor_id &&
      tramosSeSolapan(t, form) &&
      vigenciasSeSolapan(t.vigente_desde, t.vigente_hasta, form.vigente_desde, form.vigente_hasta),
    );
    if (solapada) {
      notifyError(undefined, {
        title: "El tramo se solapa con uno existente",
        description: `Ya hay un tramo días ${solapada.desde_dia}–${solapada.hasta_dia ?? "∞"} para este contenedor en vigencias traslapadas. Ajusta el rango o la vigencia.`,
      });
      return;
    }
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setIntentoEnvio(false);
    setOpen(false);
  };

  const tipoInvalido = intentoEnvio && !form.tipo_contenedor_id;

  const columns: ColumnDef<Tarifa, unknown>[] = useMemo(
    () =>
      defineColumns<Tarifa>([
        {
          id: "tipo",
          header: "Tipo contenedor",
          meta: { width: "min-w-[160px]", className: "font-medium", sticky: true },
          cell: ({ row }) => tipoMap.get(row.original.tipo_contenedor_id) ?? "—",
        },
        {
          id: "desde",
          header: "Desde día",
          meta: { width: "w-[110px]", align: "right", className: "tabular-nums" },
          cell: ({ row }) => row.original.desde_dia,
        },
        {
          id: "hasta",
          header: "Hasta día",
          meta: { width: "w-[110px]", align: "right", className: "tabular-nums" },
          cell: ({ row }) =>
            row.original.hasta_dia ?? <span aria-label="sin límite">∞</span>,
        },
        {
          ...moneyColumn<Tarifa>({
            id: "monto",
            header: "Monto/día USD",
            accessor: (t) => Number(t.monto_por_dia_usd),
            defaultCurrency: "USD",
          }),
          meta: { width: "w-[150px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
        },
        {
          ...dateColumn<Tarifa>({
            id: "desde_vig",
            header: "Vigente desde",
            accessor: (t) => t.vigente_desde,
          }),
          meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
        },
        {
          ...dateColumn<Tarifa>({
            id: "hasta_vig",
            header: "Vigente hasta",
            accessor: (t) => t.vigente_hasta,
          }),
          meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
        },
        {
          id: "acciones",
          header: "",
          meta: { width: "w-[50px]", align: "right" },
          cell: ({ row }) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setAEliminar(row.original.id)}
                aria-label="Eliminar tarifa de demoras"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ),
        },
      ]),
    [tipoMap],
  );

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
          <DataTable<Tarifa>
            columns={columns}
            data={tarifas}
            rowKey={(t) => t.id}
            emptyState={
              <div className="p-6 text-center text-muted-foreground">
                Sin tarifas. Crea la primera.
              </div>
            }
          />
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
