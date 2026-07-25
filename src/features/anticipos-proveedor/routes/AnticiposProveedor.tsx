import { useState } from "react";
import { Plus, MoreHorizontal, Ban, Link2, Inbox } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnticiposProveedor, type AnticipoProveedorRow } from "../hooks/useAnticiposProveedor";
import { RegistrarAnticipoDialog } from "../components/RegistrarAnticipoDialog";
import { AplicarAnticipoDialog } from "../components/AplicarAnticipoDialog";
import { CancelarAnticipoDialog } from "../components/CancelarAnticipoDialog";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { usePermissions } from "@/hooks/shared";
import { useProveedoresLite } from "@/features/proveedor/hooks";
import { PageSkeleton } from "@/components/shared/skeletons";

export default function AnticiposProveedor() {
  const { canEditFinance } = usePermissions();
  const [estado, setEstado] = useState<string>("todos");
  const [proveedorId, setProveedorId] = useState<string>("todos");

  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [anticipoParaAplicar, setAnticipoParaAplicar] = useState<AnticipoProveedorRow | null>(null);
  const [anticipoParaCancelar, setAnticipoParaCancelar] = useState<AnticipoProveedorRow | null>(null);

  const { data, isLoading, isError, refetch } = useAnticiposProveedor({
    estado: estado === "todos" ? null : estado,
    proveedorId: proveedorId === "todos" ? null : proveedorId,
  });

  const { data: proveedores = [] } = useProveedoresLite();

  const columns = [
    {
      header: "Fecha",
      accessorKey: "fecha_anticipo",
      cell: (info: any) => formatDate(info.getValue()),
    },
    {
      header: "Proveedor",
      accessorKey: "proveedor_nombre",
    },
    {
      header: "Monto",
      accessorKey: "monto",
      cell: (info: any) => formatCurrency(info.getValue(), info.row.original.moneda),
    },
    {
      header: "Aplicado",
      accessorKey: "aplicado",
      cell: (info: any) => formatCurrency(info.getValue(), info.row.original.moneda),
    },
    {
      header: "Disponible",
      accessorKey: "disponible",
      cell: (info: any) => (
        <span className="font-semibold text-primary">
          {formatCurrency(info.getValue(), info.row.original.moneda)}
        </span>
      ),
    },
    {
      header: "Moneda",
      accessorKey: "moneda",
    },
    {
      header: "Estado",
      accessorKey: "estado",
      cell: (info: any) => {
        const val = info.getValue();
        if (val === "disponible") return <ToneBadge tone="success">Disponible</ToneBadge>;
        if (val === "aplicado_parcial") return <ToneBadge tone="warning">Parcial</ToneBadge>;
        if (val === "aplicado_total") return <ToneBadge tone="neutral">Aplicado</ToneBadge>;
        if (val === "cancelado") return <ToneBadge tone="destructive">Cancelado</ToneBadge>;
        return <ToneBadge tone="neutral">{val}</ToneBadge>;
      },
    },
    {
      id: "actions",
      cell: (info: any) => {
        const row = info.row.original;
        const canApply = row.estado === "disponible" || row.estado === "aplicado_parcial";
        const canCancel = row.estado === "disponible";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canApply || !canEditFinance}
                onClick={() => setAnticipoParaAplicar(row)}
              >
                <Link2 className="mr-2 h-4 w-4" /> Aplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={!canCancel || !canEditFinance}
                onClick={() => setAnticipoParaCancelar(row)}
              >
                <Ban className="mr-2 h-4 w-4" /> Cancelar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer>
      <PageHeader
        title="Anticipos a proveedores"
        description="Gestión de pagos por adelantado y aplicaciones a facturas"
        actions={
          <Button onClick={() => setOpenRegistrar(true)} disabled={!canEditFinance}>
            <Plus className="mr-2 h-4 w-4" /> Registrar anticipo
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-64">
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Estado
              </label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="aplicado_parcial">Aplicado parcial</SelectItem>
                  <SelectItem value="aplicado_total">Aplicado total</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-80">
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Proveedor
              </label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los proveedores</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No hay anticipos</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                No se encontraron anticipos registrados con los filtros seleccionados.
              </p>
              {estado === "todos" && proveedorId === "todos" && canEditFinance && (
                <Button variant="outline" className="mt-4" onClick={() => setOpenRegistrar(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Registrar primer anticipo
                </Button>
              )}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              isLoading={isLoading}
              isError={isError}
              onRetry={refetch}
            />
          )}
        </CardContent>
      </Card>

      <RegistrarAnticipoDialog
        open={openRegistrar}
        onOpenChange={setOpenRegistrar}
      />

      <AplicarAnticipoDialog
        open={!!anticipoParaAplicar}
        onOpenChange={(o) => !o && setAnticipoParaAplicar(null)}
        anticipo={anticipoParaAplicar}
      />

      <CancelarAnticipoDialog
        open={!!anticipoParaCancelar}
        onOpenChange={(o) => !o && setAnticipoParaCancelar(null)}
        anticipo={anticipoParaCancelar}
      />
    </PageContainer>
  );
}
