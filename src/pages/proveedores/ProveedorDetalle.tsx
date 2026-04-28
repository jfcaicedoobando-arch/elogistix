import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Truck, Pencil, Trash2, FileX, PackageX, MoreHorizontal } from "lucide-react";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, toTitleCase, formatPhoneMx, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import EditarProveedorDialog from "@/components/proveedor/EditarProveedorDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import EmptyState from "@/components/empty/EmptyState";
import { useProveedorDetalleController } from "@/hooks/proveedor/useProveedorDetalleController";

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    proveedor,
    isLoading,
    isDeleting,
    operaciones,
    totalFacturado,
    totalPagado,
    totalPendiente,
    canEdit,
    isAdmin,
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    handleUpdate,
    handleDelete,
    navigate,
  } = useProveedorDetalleController();
  useRegisterBreadcrumbLabel(id, proveedor?.nombre);

  if (isLoading) {
    return <div className="space-y-4 p-8">{[1,2,3].map(indice => <Skeleton key={indice} className="h-24 w-full" />)}</div>;
  }

  if (!proveedor) {
    return (
      <div className="py-12">
        <EmptyState
          icon={PackageX}
          title="Proveedor no encontrado"
          description="El proveedor que buscas no existe o fue eliminado."
          primaryAction={{
            label: "Volver a Proveedores",
            onClick: () => navigate("/proveedores"),
            variant: "outline",
          }}
        />
      </div>
    );
  }

  const nombreFmt = toTitleCase(proveedor.nombre);
  const rfcFmt = (proveedor.rfc || "").toUpperCase();
  const contactoFmt = toTitleCase(proveedor.contacto);
  const telFmt = formatPhoneMx(proveedor.telefono);
  const opsLabel = operaciones.length === 1 ? "operación" : "operaciones";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proveedores")} aria-label="Volver a proveedores">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Truck className="h-6 w-6 text-accent" />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" title={proveedor.nombre}>{nombreFmt}</h1>
            <Badge variant="secondary">{proveedor.tipo}</Badge>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center">
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label={`Más acciones del proveedor ${nombreFmt}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">RFC:</span> <span className="font-mono">{rfcFmt}</span></p>
            <p><span className="text-muted-foreground">Contacto:</span> {contactoFmt}</p>
            <p><span className="text-muted-foreground">Email:</span> {proveedor.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {telFmt}</p>
            <p><span className="text-muted-foreground">Moneda preferida:</span> {proveedor.moneda_preferida}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Facturado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalFacturado, proveedor.moneda_preferida)}</p>
            <p className="text-xs text-muted-foreground">{operaciones.length} {opsLabel}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Pagado</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPagado, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-warning">Pendiente</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPendiente, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Historial de Operaciones</CardTitle></CardHeader>
        <CardContent className="p-0">
          {operaciones.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operaciones.map((operacion, indice) => (
                  <TableRow key={indice}>
                    <TableCell>
                      <Link to={`/embarques/${operacion.embarqueId}`} className="text-primary hover:underline font-medium text-xs">
                        {operacion.expediente}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs" title={operacion.clienteNombre}>{toTitleCase(operacion.clienteNombre)}</TableCell>
                    <TableCell className="text-xs">{toTitleCase(operacion.concepto)}</TableCell>
                    <TableCell className="text-xs font-medium text-right tabular-nums">{formatCurrency(operacion.monto, operacion.moneda)}</TableCell>
                    <TableCell><Badge className={`text-xs ${getEstadoColor(operacion.estadoLiquidacion)}`}>{operacion.estadoLiquidacion}</Badge></TableCell>
                    <TableCell className="text-xs">{operacion.fechaVencimiento ? formatDate(operacion.fechaVencimiento) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={FileX}
                title="Sin operaciones registradas"
                description="Cuando este proveedor aparezca en costos de embarques, las operaciones se mostrarán aquí."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <EditarProveedorDialog
        proveedor={proveedor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleUpdate}
      />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName="proveedor"
        description={`Estás a punto de eliminar a ${nombreFmt}. Esta acción no se puede deshacer.`}
        finalDescription={`¿Realmente deseas eliminar permanentemente a ${nombreFmt}?`}
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
