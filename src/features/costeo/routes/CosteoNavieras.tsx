/**
 * Página: Condiciones por naviera (carta garantía + tabulador de demoras).
 * v13.172.16: migrado de `<Table>` crudo a `DataTable` para homologar look & feel.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, FileSignature } from "lucide-react";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionForm } from "@/features/costeo/components/NavieraCondicionForm";
import { DemorasTarifaEditor } from "@/features/costeo/components/DemorasTarifaEditor";
import { CartaGarantiaBadge } from "@/components/shared/CartaGarantiaBadge";
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { NavieraQuickCreate } from "@/features/costeo/components/NavieraQuickCreate";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Ship, SearchX } from "lucide-react";
import { NavieraFiltrosBar } from "@/features/costeo/components/NavieraFiltrosBar";
import { filtrarNavieras, type EstadoNavieraFiltro } from "@/features/costeo/lib/navierasFiltro";

interface FilaNaviera {
  naviera_id: string;
  naviera_nombre: string;
  naviera_code: string;
  condicion: CosteoNavieraCondicion | null;
}

export default function CosteoNavieras() {
  const { data: navieras = [], isLoading: loadingNav, isError: errorNav, refetch: refetchNav } = useNavierasCatalogo();
  const { data: condiciones = [], isLoading: loadingCond, isError: errorCond, refetch: refetchCond } = useCondicionesNaviera();
  const [seleccion, setSeleccion] = useState<FilaNaviera | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoNavieraFiltro>("todos");

  const filas: FilaNaviera[] = useMemo(() => {
    const mapa = new Map(condiciones.map((c) => [c.naviera_id, c]));
    return navieras.map((n) => ({
      naviera_id: n.id,
      naviera_nombre: n.name,
      naviera_code: n.code,
      condicion: mapa.get(n.id) ?? null,
    }));
  }, [navieras, condiciones]);

  const filasFiltradas = useMemo(
    () => filtrarNavieras(filas, busqueda, estado),
    [filas, busqueda, estado],
  );

  const hayFiltrosActivos = busqueda.trim() !== "" || estado !== "todos";
  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("todos");
  };

  const isLoading = loadingNav || loadingCond;
  const isError = errorNav || errorCond;
  const refetchAll = () => {
    void refetchNav();
    void refetchCond();
  };

  const columns: ColumnDef<FilaNaviera, unknown>[] = useMemo(
    () =>
      defineColumns<FilaNaviera>([
        {
          id: "naviera",
          header: "Naviera",
          accessorFn: (f) => f.naviera_nombre,
          enableSorting: true,
          meta: { width: COL_W.ruta, className: "font-medium whitespace-nowrap", sticky: true },
          cell: ({ row }) => row.original.naviera_nombre,
        },
        {
          id: "scac",
          header: "SCAC",
          meta: { width: COL_W.fecha, className: "font-mono text-body-sm" },
          cell: ({ row }) => row.original.naviera_code,
        },
        {
          id: "carta",
          header: "Carta garantía",
          meta: { width: COL_W.nombre },
          cell: ({ row }) => (
            <CartaGarantiaBadge
              tieneCarta={row.original.condicion?.tiene_carta_garantia ?? false}
              vigenteHasta={row.original.condicion?.carta_garantia_vigente_hasta ?? null}
            />
          ),
        },
        {
          id: "diaslibres",
          header: "Días libres",
          meta: { width: COL_W.fecha, align: "right", className: "tabular-nums" },
          cell: ({ row }) => row.original.condicion?.dias_libres_demoras_default ?? "—",
        },
        {
          id: "vinculo",
          header: "Proveedor vinculado",
          meta: { width: COL_W.nombre, className: "text-muted-foreground hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
          cell: ({ row }) => (row.original.condicion ? "Vinculado" : "Sin configurar"),
        },
        {
          id: "acciones",
          header: "Acciones",
          meta: { width: COL_W.monto, align: "right" },
          cell: ({ row }) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => setSeleccion(row.original)}>
                <Settings2 className="size-4 mr-1" /> Configurar
              </Button>
            </div>
          ),
        },
      ]),
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Condiciones por naviera"
        description="Carta garantía, días libres y tabulador escalonado de demoras por tipo de contenedor."
        actions={<NavieraQuickCreate variante="boton" onCreada={() => undefined} />}
      />

      {isError ? (
        <ErrorState onRetry={refetchAll} />
      ) : isLoading ? (
        <ListSkeleton rows={6} variant="table" />
      ) : (
        <>
          <NavieraFiltrosBar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            estado={estado}
            onEstadoChange={setEstado}
          />
          <Card>
            <DataTable<FilaNaviera>
              columns={columns}
              data={filasFiltradas}
              rowKey={(f) => f.naviera_id}
              emptyState={
                filas.length === 0 && !hayFiltrosActivos ? (
                  <EmptyStateInline
                    icon={Ship}
                    message="Aún no hay navieras en el catálogo de tu organización."
                  >
                    <NavieraQuickCreate variante="boton" onCreada={() => undefined} />
                  </EmptyStateInline>
                ) : (
                  <EmptyStateInline
                    icon={SearchX}
                    message="Sin resultados para tu búsqueda o filtro."
                    action={{ label: "Limpiar filtros", onClick: limpiarFiltros }}
                  />
                )
              }
            />
          </Card>
        </>
      )}

      <FormDialogShell
        open={!!seleccion}
        onOpenChange={(o) => !o && setSeleccion(null)}
        icon={FileSignature}
        title={seleccion ? `Condiciones — ${seleccion.naviera_nombre}` : "Condiciones"}
        description="Carta garantía, días libres y tabulador de demoras por tipo de contenedor."
        size="3xl"
        footer={null}
      >
        {seleccion && (
          <Tabs defaultValue="condiciones">
            <TabsList>
              <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
              <TabsTrigger
                value="demoras"
                disabled={!seleccion.condicion}
                title={
                  !seleccion.condicion
                    ? "Primero guarda las condiciones generales para habilitar el tabulador"
                    : undefined
                }
              >
                Tabulador de demoras
              </TabsTrigger>
            </TabsList>
            <TabsContent value="condiciones" className="pt-4">
              <NavieraCondicionForm
                navieraId={seleccion.naviera_id}
                navieraNombre={seleccion.naviera_nombre}
                existente={seleccion.condicion}
                onSaved={() => setSeleccion(null)}
              />
            </TabsContent>
            <TabsContent value="demoras" className="pt-4">
              {seleccion.condicion ? (
                <DemorasTarifaEditor navieraCondicionId={seleccion.condicion.id} />
              ) : (
                <p className="text-body text-muted-foreground">
                  Primero guarda las condiciones generales para habilitar el tabulador.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </FormDialogShell>
    </PageContainer>
  );
}
