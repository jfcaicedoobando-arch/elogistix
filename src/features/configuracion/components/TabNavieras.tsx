import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAllNavieras, useAdminNavieras } from "@/features/catalogos/hooks";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { NavieraFormDialog } from "@/components/shared/NavieraFormDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import type { Naviera } from "@/features/catalogos/services";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { usePermissions } from "@/hooks/shared";

/** Lo que ve la empresa: global encendido y sin apagado propio. */
const visibleOrg = (n: Naviera) => n.activoOrg ?? n.activo;

export default function TabNavieras() {
  const { data: navieras = [], isLoading } = useAllNavieras();
  const { agregarNaviera, toggleActivo, eliminarNaviera } = useAdminNavieras();
  const { isSuperAdmin } = usePermissions();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  // Q-13/Q-12 (Ola 4): edición reutiliza el mismo `NavieraFormDialog` del
  // empty-state de `NavieraSelect` — un solo lugar cuida el fix de overlay.
  const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);
  // UX-01/UIA-05: eliminar exige confirmación de doble paso y sólo se ofrece
  // a quien puede administrar el tenant.
  const [navieraAEliminar, setNavieraAEliminar] = useState<Naviera | null>(null);

  const handleAgregar = () => {
    if (!nuevoCode.trim() || !nuevoName.trim()) return;
    agregarNaviera.mutate(
      { code: nuevoCode.trim().toUpperCase(), name: nuevoName.trim() },
      { onSuccess: () => { setNuevoCode(""); setNuevoName(""); } }
    );
  };

  const filtradas = navieras.filter((n) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
  });

  const columns: ColumnDef<Naviera, unknown>[] = defineColumns<Naviera>([
    { id: "code", header: "Código", meta: { className: "font-mono text-xs" }, cell: ({ row }) => row.original.code },
    { id: "name", header: "Nombre", cell: ({ row }) => row.original.name },
    {
      id: "activo", header: "Visible en mi empresa",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => (
        <Switch
          checked={visibleOrg(row.original)}
          disabled={!row.original.activo}
          onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })}
          aria-label={visibleOrg(row.original) ? `Ocultar naviera ${row.original.name} en mi empresa` : `Mostrar naviera ${row.original.name} en mi empresa`}
        />
      ),
    },
    {
      id: "acciones", header: "",
      meta: { headerClassName: "w-24" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0" onClick={() => setNavieraEnEdicion(row.original)} aria-label={`Editar naviera ${row.original.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-destructive hover:text-destructive" disabled={eliminarNaviera.isPending} onClick={() => setNavieraAEliminar(row.original)} aria-label={`Eliminar naviera ${row.original.name}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Navieras</CardTitle>
        <CardDescription>Catálogo compartido. Enciende o apaga las navieras que quieres ver en tu empresa; no afecta a otras empresas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSuperAdmin && (
        <div className="flex flex-wrap gap-2 items-end">
          <FormField label="Código" className="space-y-1">
            <Input className="w-28" placeholder="MAERSK" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
          </FormField>
          <FormField label="Nombre" className="space-y-1">
            <Input className="w-64" placeholder="Maersk Line" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
          </FormField>
          {/* UX-16: sin campos completos el submit fallaba en silencio (early
              return de handleAgregar); ahora el botón se deshabilita. */}
          <Button
            size="sm"
            onClick={handleAgregar}
            disabled={agregarNaviera.isPending || !nuevoCode.trim() || !nuevoName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        )}

        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre…" />

        <div className="max-h-[calc(100vh-20rem)] min-h-[320px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={filtradas}
            isLoading={isLoading}
            emptyMessage="No se encontraron navieras"
            rowKey={(n) => n.id}
            rowClassName={(n) => !visibleOrg(n) ? "opacity-50" : ""}
            density={TABLE_DENSITY.embebida}
          />
        </div>
        <p className="text-xs text-muted-foreground">{navieras.length} navieras en total · {navieras.filter(visibleOrg).length} visibles en mi empresa</p>
      </CardContent>
      <NavieraFormDialog
        open={!!navieraEnEdicion}
        onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
        naviera={navieraEnEdicion}
      />
      <DoubleConfirmDeleteDialog
        open={!!navieraAEliminar}
        onOpenChange={(open) => { if (!open) setNavieraAEliminar(null); }}
        entityName={navieraAEliminar ? `la naviera "${navieraAEliminar.name}"` : "esta naviera"}
        description="La naviera se eliminará del catálogo. Las cotizaciones y embarques existentes no se modifican."
        isPending={eliminarNaviera.isPending}
        onConfirm={() => {
          if (navieraAEliminar) eliminarNaviera.mutate(navieraAEliminar.id);
        }}
      />
    </Card>
  );
}
