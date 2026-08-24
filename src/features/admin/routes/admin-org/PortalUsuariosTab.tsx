import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import {
  useUsuariosPortalCliente,
  useUsuariosPortalAgente,
  useDeletePortalUser,
} from "@/features/admin/hooks/usuario";
import type {
  PortalAgenteUserRow,
  PortalClienteUserRow,
} from "@/features/admin/services/usuario/portales";
import { usePortalUsuarioColumns } from "./portalUsuariosColumns";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  tipo: "cliente" | "agente";
}

export function PortalUsuariosTab({ tipo }: Props) {
  const clienteQuery = useUsuariosPortalCliente();
  const agenteQuery = useUsuariosPortalAgente();
  const query = tipo === "cliente" ? clienteQuery : agenteQuery;
  const data = (query.data ?? []) as Array<PortalClienteUserRow | PortalAgenteUserRow>;

  const deleteMutation = useDeletePortalUser(tipo);
  const [deleteTarget, setDeleteTarget] = useState<
    PortalClienteUserRow | PortalAgenteUserRow | null
  >(null);

  const columns = usePortalUsuarioColumns({
    tipo,
    onDelete: setDeleteTarget,
  });

  const fichaPath = tipo === "cliente" ? "/clientes" : "/costeo/agentes";
  const fichaLabel = tipo === "cliente" ? "ficha del cliente" : "ficha del agente";

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.user_id);
      setDeleteTarget(null);
    } catch {
      // notificación gestionada por el hook
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-body-sm text-muted-foreground">
        Las cuentas se crean desde la {" "}
        <Link to={fichaPath} className="underline hover:text-foreground">
          {fichaLabel}
        </Link>
        . Aquí puedes ver el listado y eliminar accesos.
      </p>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={data}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyMessage={
            tipo === "cliente"
              ? "Aún no hay clientes con acceso al Portal Cliente."
              : "Aún no hay agentes con acceso al Portal Agente."
          }
          rowKey={(u) => u.id}
          density={TABLE_DENSITY.listado}
          tableClassName="w-full"
        />
      </div>

      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        // O3.7.7 (FIX-R3): mismos fallbacks que UsuariosInternosDialogs —
        // antes un email ausente imprimía "El usuario undefined perderá acceso…".
        entityName={deleteTarget?.email ?? "este usuario"}
        description={`El usuario ${deleteTarget?.email ?? "seleccionado"} perderá acceso al portal y será eliminado permanentemente del sistema.`}
        finalDescription="Esta acción no se puede deshacer."
        confirmLabel="Eliminar cuenta"
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
