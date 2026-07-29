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
import { CartaGarantiaBadge } from "@/features/costeo/components/CartaGarantiaBadge";
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";
import { useDocumentTitle } from "@/hooks/shared";

interface FilaNaviera {
  naviera_id: string;
  naviera_nombre: string;
  naviera_code: string;
  condicion: CosteoNavieraCondicion | null;
}

export default function AgenteGarantias() {
  useDocumentTitle('Carta Garantía y Demoras');
  const { data: navieras = [], isLoading: loadingNav } = useNavierasCatalogo();
  const { data: condiciones = [], isLoading: loadingCond } = useCondicionesNaviera();
  const [seleccion, setSeleccion] = useState<FilaNaviera | null>(null);

  const filas: FilaNaviera[] = useMemo(() => {
    const mapa = new Map(condiciones.map((c) => [c.naviera_id, c]));
    return navieras.map((n) => ({
      naviera_id: n.id,
      naviera_nombre: n.name,
      naviera_code: n.code,
      condicion: mapa.get(n.id) ?? null,
    }));
  }, [navieras, condiciones]);

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
        meta: { className: "font-mono text-xs", width: "w-[100px]" },
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
    <div className="space-y-4">
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Carta Garantía y Demoras"
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

      <DataTable<FilaNaviera>
        columns={columns}
        data={filas}
        rowKey={(f) => f.naviera_id}
        isLoading={loadingNav || loadingCond}
        onRowClick={(f) => setSeleccion(f)}
        rowClassName={(f) => (seleccion?.naviera_id === f.naviera_id ? "bg-accent/40" : "")}
        emptyMessage="Sin navieras configuradas."
      />


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
