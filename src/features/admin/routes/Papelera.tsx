import { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { Navigate } from "react-router-dom";
import { usePapelera, type SoftTable, type TrashRow } from "@/features/admin/hooks";
import { TABLAS, GRUPOS } from "./papelera/tablas";
import { buildPapeleraColumns } from "./papelera/columns";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

export default function Papelera() {
  useDocumentTitle('Papelera');
  const { isAdmin } = usePermissions();
  const { tabla, setTabla, rows, isLoading, counts, restore, purge } = usePapelera(isAdmin);
  const [purgeTarget, setPurgeTarget] = useState<TrashRow | null>(null);

  const countByTable = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of counts) map.set(c.tabla, Number(c.total ?? 0));
    return map;
  }, [counts]);

  const totalPapelera = useMemo(
    () => counts.reduce((acc, c) => acc + Number(c.total ?? 0), 0),
    [counts],
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  const columns = buildPapeleraColumns({
    onRestore: (id) => restore.mutate(id),
    onPurgeTarget: setPurgeTarget,
    isBusy: restore.isPending || purge.isPending,
  });

  return (
    <PageContainer>
      <PageHeader
        icon={<Trash2 className="h-6 w-6" />}
        title="Papelera"
        description="Registros eliminados (soft delete). Restaura o purga definitivamente. Al restaurar un embarque, sus contenedores, documentos, notas, eventos, facturas, seguros y conceptos se recuperan juntos."
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tabla} onValueChange={(v) => setTabla(v as SoftTable)}>
          <SelectTrigger className="w-[320px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRUPOS.map((g) => {
              const items = TABLAS.filter((t) => t.grupo === g);
              if (items.length === 0) return null;
              return (
                <SelectGroup key={g}>
                  <SelectLabel>{g}</SelectLabel>
                  {items.map((t) => {
                    const n = countByTable.get(t.value) ?? 0;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{t.label}</span>
                          {n > 0 && <Badge variant="secondary" className="ml-auto">{n}</Badge>}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "registro" : "registros"} en esta tabla
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Total en papelera: <strong>{totalPapelera}</strong>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyMessage="La papelera está vacía"
            density={TABLE_DENSITY.listado}
          />
        </CardContent>
      </Card>

      <DoubleConfirmDeleteDialog
        open={!!purgeTarget}
        onOpenChange={(v) => { if (!v) setPurgeTarget(null); }}
        entityName={purgeTarget ? `«${purgeTarget.label}»` : "este registro"}
        description="El registro se eliminará definitivamente de la base de datos. Esta acción no se puede deshacer."
        finalDescription="Una vez purgado no podrás recuperarlo desde la papelera. ¿Continuar?"
        isPending={purge.isPending}
        onConfirm={async () => {
          if (purgeTarget) await purge.mutateAsync(purgeTarget.id);
          setPurgeTarget(null);
        }}
      />
    </PageContainer>
  );
}
