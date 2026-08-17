/**
 * Tabulador de venta de demoras al cliente.
 * v13.172.16: migrado de `<Table>` crudo a `DataTable` para unificar look & feel.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { Plus } from "lucide-react";
import { useDemorasVenta, useDemorasVentaMutations } from "@/features/costeo/hooks/useDemorasVenta";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { NuevaTarifaDemoraDialog } from "@/features/costeo/components/NuevaTarifaDemoraDialog";
import { todayLocalISO } from "@/lib/date/today";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { crearColumnasDemorasVenta } from "./CosteoDemorasVentaColumns";
import { validarTramoDias, validarSinSolape } from "./costeoDemorasVentaValidacion";

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
  const { data: tarifas = [], isLoading, isError, refetch } = useDemorasVenta();
  const { crear, eliminar } = useDemorasVentaMutations();
  const { data: tipos = [] } = useTiposContenedor();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DemoraVentaTarifaInput>(EMPTY);
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t.code || t.name])), [tipos]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!form.tipo_contenedor_id || form.monto_por_dia_usd < 0) return;
    if (!validarTramoDias(form)) return;
    if (!validarSinSolape(tarifas, form)) return;
    await crear.mutateAsync(form);
    setForm(EMPTY);
    setIntentoEnvio(false);
    setOpen(false);
  };

  const tipoInvalido = intentoEnvio && !form.tipo_contenedor_id;

  const columns = useMemo(
    () => crearColumnasDemorasVenta(tipoMap, (id) => setAEliminar(id)),
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

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} variant="table" />
      ) : (
        <Card>
          <DataTable
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
