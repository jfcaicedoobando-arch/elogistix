import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  Truck, Pencil, Trash2, PackageX, MoreHorizontal,
} from "lucide-react";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { toTitleCase } from "@/lib/formatters";
import EditarProveedorDialog from "@/features/proveedor/components/EditarProveedorDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProveedorDetalleController } from "@/features/proveedor/hooks";
import { ProveedorOperacionesTable } from "../components/ProveedorOperacionesTable";
import { ProveedorCsfUpdateButton } from "../components/ProveedorCsfUpdateButton";
import { ProveedorDatosBancariosCard } from "../components/ProveedorDatosBancariosCard";
import { ProveedorDatosGeneralesCard } from "../components/ProveedorDatosGeneralesCard";
import { ProveedorResumenCards } from "../components/ProveedorResumenCards";
import { ProveedorSaludTab } from "../components/ProveedorSaludTab";

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    proveedor, isLoading, isDeleting, operaciones,
    totalFacturado, totalPagado, totalPendiente,
    canEdit, isAdmin, editOpen, setEditOpen,
    deleteOpen, setDeleteOpen, handleUpdate, handleDelete,
  } = useProveedorDetalleController();
  useRegisterBreadcrumbLabel(id, proveedor?.nombre);

  if (isLoading) {
    return <div className="p-8"><DetailSkeleton /></div>;
  }

  if (!proveedor) {
    return (
      <DetailNotFound
        icon={PackageX}
        title="Proveedor no encontrado"
        description="El proveedor que buscas no existe, fue eliminado o no tienes permiso para verlo."
        backTo="/compras/proveedores"
        backLabel="Volver a Proveedores"
      />
    );
  }


  const nombreFmt = toTitleCase(proveedor.nombre);
  const rfcFmt = (proveedor.rfc || "").toUpperCase();
  const esNacional = proveedor.origen_proveedor === "Nacional";
  const categoriaLabel = proveedor.categoria === "GastoOperativo"
    ? (proveedor.subtipo_gasto ?? "Gasto de administración")
    : (proveedor.tipo ?? "—");

  return (
    <PageContainer>
      <DetailHeader
        backTo="/compras/proveedores"
        backLabel="Volver a Proveedores"
        icon={<Truck className="h-6 w-6 text-accent shrink-0" />}
        title={nombreFmt}
        subtitle={rfcFmt ? `RFC / Tax ID · ${rfcFmt}` : undefined}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{categoriaLabel}</Badge>
            <Badge variant="outline" className="font-normal">
              {esNacional ? "Nacional" : "Extranjero"}
            </Badge>
          </div>
        }
        trailing={canEdit ? (
          <>
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
          </>
        ) : undefined}
      />

      <ProveedorResumenCards
        totalFacturado={totalFacturado}
        totalPagado={totalPagado}
        totalPendiente={totalPendiente}
        moneda="MXN"
        porMoneda={agregados.porMoneda}
        monedasSinTc={agregados.monedasSinTc}
        operacionesCount={operaciones.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProveedorDatosGeneralesCard
          rfc={proveedor.rfc}
          contacto={proveedor.contacto}
          email={proveedor.email}
          telefono={proveedor.telefono}
          monedaPreferida={proveedor.moneda_preferida}
        />

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
          onCapturar={canEdit ? () => setEditOpen(true) : undefined}
        />
      </div>

      <Tabs defaultValue="operaciones">
        <TabsList>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
          <TabsTrigger value="salud">Salud</TabsTrigger>
        </TabsList>
        <TabsContent value="operaciones" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Historial de operaciones
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  {operaciones.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
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

