import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  ArrowLeft, Truck, Pencil, Trash2, PackageX, MoreHorizontal,
} from "lucide-react";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, toTitleCase, formatPhoneMx } from "@/lib/formatters";
import EditarProveedorDialog from "@/features/proveedor/components/EditarProveedorDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import EmptyState from "@/components/empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProveedorDetalleController } from "@/features/proveedor/hooks";
import { ProveedorOperacionesTable } from "../components/ProveedorOperacionesTable";
import { ProveedorCsfUpdateButton } from "../components/ProveedorCsfUpdateButton";
import { ProveedorDatosBancariosCard } from "../components/ProveedorDatosBancariosCard";
import { ProveedorSaludTab } from "../components/ProveedorSaludTab";

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    proveedor, isLoading, isDeleting, operaciones,
    totalFacturado, totalPagado, totalPendiente,
    canEdit, isAdmin, editOpen, setEditOpen,
    deleteOpen, setDeleteOpen, handleUpdate, handleDelete, navigate,
  } = useProveedorDetalleController();
  useRegisterBreadcrumbLabel(id, proveedor?.nombre);

  if (isLoading) {
    return <div className="space-y-4 p-8">{[1, 2, 3].map((indice) => <Skeleton key={indice} className="h-24 w-full" />)}</div>;
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
            onClick: () => navigate("/compras/proveedores"),
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
  const esNacional = proveedor.origen_proveedor === "Nacional";

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/compras/proveedores")} aria-label="Volver a proveedores">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Truck className="h-6 w-6 text-accent" />
          <div className="flex items-center gap-3">
            <h1 className="text-display font-bold tracking-tight" title={proveedor.nombre}>{nombreFmt}</h1>
            <Badge variant="secondary">
              {proveedor.categoria === "GastoOperativo" ? (proveedor.subtipo_gasto ?? "Gasto de administración") : (proveedor.tipo ?? "—")}
            </Badge>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center">
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            {esNacional && (
              <ProveedorCsfUpdateButton proveedor={proveedor} onUpdate={handleUpdate} />
            )}
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

      <ProveedorDatosBancariosCard
        banco={proveedor.banco}
        clabe={proveedor.clabe}
        origen={proveedor.origen_proveedor}
        bancoPais={proveedor.banco_pais}
        swiftBic={proveedor.swift_bic}
        iban={proveedor.iban}
        abaRouting={proveedor.aba_routing}
        bancoDireccion={proveedor.banco_direccion}
        bancoIntermediario={proveedor.banco_intermediario}
        bancoIntermediarioSwift={proveedor.banco_intermediario_swift}
        beneficiario={proveedor.beneficiario}
        referenciaPago={proveedor.referencia_pago}
      />

      <Tabs defaultValue="operaciones">
        <TabsList>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
          <TabsTrigger value="salud">Salud</TabsTrigger>
        </TabsList>
        <TabsContent value="operaciones" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Historial de Operaciones</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ProveedorOperacionesTable operaciones={operaciones} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="salud" className="mt-4">
          <ProveedorSaludTab proveedorId={proveedor.id} />
        </TabsContent>
      </Tabs>

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
    </PageContainer>
  );
}
