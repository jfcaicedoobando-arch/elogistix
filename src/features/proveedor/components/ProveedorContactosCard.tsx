/**
 * Ola 4 — Contactos múltiples del proveedor, homologado con la tabla de
 * contactos del cliente: varias personas por proveedor y un solo principal.
 */
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import EmptyState from "@/components/empty/EmptyState";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { ContactoProveedorDialog } from "./ContactoProveedorDialog";
import { proveedorContactosColumns } from "./proveedorContactosColumns";
import type { ContactoProveedor } from "@/features/proveedor/domain/contactosProveedor";
import {
  useProveedorContactos,
  useGuardarContactoProveedor,
  useEliminarContactoProveedor,
} from "@/features/proveedor/hooks/useProveedorContactos";

interface Props {
  proveedorId: string;
  organizationId: string;
  canEdit: boolean;
}

export function ProveedorContactosCard({ proveedorId, organizationId, canEdit }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useProveedorContactos(proveedorId);
  const guardar = useGuardarContactoProveedor(proveedorId, organizationId);
  const eliminar = useEliminarContactoProveedor(proveedorId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enEdicion, setEnEdicion] = useState<ContactoProveedor | null>(null);
  const [porBorrar, setPorBorrar] = useState<ContactoProveedor | null>(null);

  const contactos = data ?? [];

  const abrir = (contacto: ContactoProveedor | null) => {
    setEnEdicion(contacto);
    setDialogOpen(true);
  };

  const cols: ColumnDef<ContactoProveedor, unknown>[] = defineColumns<ContactoProveedor>(
    proveedorContactosColumns({
      onEditar: canEdit ? (c) => abrir(c) : undefined,
      onEliminar: canEdit ? (c) => setPorBorrar(c) : undefined,
    }),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>
          Contactos
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">
            {contactos.length}
          </span>
        </CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => abrir(null)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo contacto
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isError ? (
          <ErrorStateInline
            title="No pudimos cargar los contactos del proveedor"
            message={error instanceof Error ? error.message : "Error desconocido"}
            onRetry={() => void refetch()}
            retrying={isFetching}
            className="m-6"
          />
        ) : (
          <DataTable
            columns={cols}
            data={contactos}
            isLoading={isLoading}
            rowKey={(c) => c.id}
            density={TABLE_DENSITY.embebida}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Users}
                  title="Sin contactos registrados"
                  description="Agrega a las personas de tráfico, facturación y cobranza del proveedor."
                />
              </div>
            }
          />
        )}
      </CardContent>

      {canEdit && (
        <ContactoProveedorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          contacto={enEdicion}
          isPending={guardar.isPending}
          onGuardar={(form) =>
            guardar.mutate(
              { id: enEdicion?.id, form, expectedUpdatedAt: enEdicion?.updated_at ?? null },
              { onSuccess: () => setDialogOpen(false) },
            )
          }
        />
      )}

      <DoubleConfirmDeleteDialog
        open={porBorrar !== null}
        onOpenChange={(v) => { if (!v) setPorBorrar(null); }}
        entityName={porBorrar?.nombre ?? ""}
        description="El contacto dejará de aparecer en la ficha del proveedor."
        isPending={eliminar.isPending}
        onConfirm={() => {
          if (!porBorrar) return;
          eliminar.mutate(porBorrar.id, { onSuccess: () => setPorBorrar(null) });
        }}
      />
    </Card>
  );
}
