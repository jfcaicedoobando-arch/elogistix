/**
 * Carta garantía y tabulador de demoras del agente.
 *
 * Reutiliza el flujo de `CosteoNavieras` (NavieraCondicionForm + DemorasTarifaEditor).
 * v13.172.18: migrado a `DataTable` (Fase 5 homologación); onRowClick selecciona la fila
 * y abre el panel lateral con las condiciones.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, FileSignature, Info, ShieldCheck } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionForm } from "@/features/costeo/components/NavieraCondicionForm";
import { DemorasTarifaEditor } from "@/features/costeo/components/DemorasTarifaEditor";
import { CartaGarantiaBadge } from "@/components/shared/CartaGarantiaBadge";
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";
import { useDocumentTitle } from "@/hooks/shared";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
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

export default function AgenteGarantias() {
  useDocumentTitle('Carta Garantía y Demoras');
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

  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("todos");
  };

  const columns = useMemo<ColumnDef<FilaNaviera, unknown>[]>(
    () => defineColumns<FilaNaviera>([
      {
        id: "naviera",
        header: "Naviera",
        accessorFn: (f) => f.naviera_nombre,
        sortingFn: sortByString((f) => f.naviera_nombre),
        enableSorting: true,
        meta: { sticky: true, className: "font-medium" },
        cell: ({ row }) => row.original.naviera_nombre,
      },
      {
        id: "scac",
        header: "SCAC",
        accessorFn: (f) => f.naviera_code,
        meta: { className: "font-mono text-xs", width: COL_W.fecha },
        cell: ({ row }) => row.original.naviera_code,
      },
      {
        id: "carta",
        header: "Carta garantía",
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
        accessorFn: (f) => f.condicion?.dias_libres_demoras_default ?? null,
        sortingFn: sortByNumber((f) => f.condicion?.dias_libres_demoras_default ?? null),
        enableSorting: true,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => row.original.condicion?.dias_libres_demoras_default ?? "—",
      },
      {
        id: "acciones",
        header: "Acciones",
        meta: { width: "w-32", align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={() => setSeleccion(row.original)}>
              <Settings2 className="h-4 w-4 mr-1" /> Configurar
            </Button>
          </div>
        ),
      },
    ]),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Carta garantía y demoras"
        description="Mantén actualizada tu carta garantía y el tabulador escalonado de demoras por naviera."
      />

      <Card className="p-3 flex items-start gap-2 bg-muted/40">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>¿Por qué importa?</strong> La carta garantía vigente permite que tus tarifas
          aparezcan como prioritarias en el comparador de cotizaciones. Si vence, el sistema
          marca tus tarifas con un aviso amarillo. El tabulador escalonado define cuánto cobra la
          naviera por cada día extra de demora (después de los días libres).
        </p>
      </Card>

      {errorNav || errorCond ? (
        <ErrorState
          onRetry={() => {
            void refetchNav();
            void refetchCond();
          }}
        />
      ) : (
        <>
          <NavieraFiltrosBar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            estado={estado}
            onEstadoChange={setEstado}
          />
          <ResponsiveDataTable<FilaNaviera>
            columns={columns}
            data={filasFiltradas}
            rowKey={(f) => f.naviera_id}
            isLoading={loadingNav || loadingCond}
            onRowClick={(f) => setSeleccion(f)}
            rowClassName={(f) => (seleccion?.naviera_id === f.naviera_id ? "bg-accent/40" : "")}
            mobileCard={(f) => (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium text-body truncate">{f.naviera_nombre}</div>
                  <div className="text-label text-muted-foreground font-mono">{f.naviera_code}</div>
                  <CartaGarantiaBadge
                    tieneCarta={f.condicion?.tiene_carta_garantia ?? false}
                    vigenteHasta={f.condicion?.carta_garantia_vigente_hasta ?? null}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={(e) => { e.stopPropagation(); setSeleccion(f); }}
                >
                  <Settings2 className="h-4 w-4 mr-1" /> Configurar
                </Button>
              </div>
            )}
            emptyState={
              filas.length === 0 ? (
                <EmptyStateInline icon={Ship} message="Sin navieras configuradas." />
              ) : (
                <EmptyStateInline
                  icon={SearchX}
                  message="Sin resultados para tu búsqueda o filtro."
                  action={{ label: "Limpiar filtros", onClick: limpiarFiltros }}
                />
              )
            }
          />
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
                title={!seleccion.condicion ? "Primero guarda las condiciones generales" : undefined}
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
                <p className="text-sm text-muted-foreground">
                  Primero guarda las condiciones generales para habilitar el tabulador.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </FormDialogShell>
    </div>
  );
}
