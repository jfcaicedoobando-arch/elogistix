import { Landmark, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { PageContainer } from "@/components/shared/PageContainer";
import { useTesoreriaCuentasController } from "@/features/tesoreria/hooks/useTesoreriaCuentasController";
import { useSaldosCuentas } from "@/features/tesoreria/hooks/useTesoreriaCuentas";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { CuentaBancariaCard } from "./_sections/CuentaBancariaCard";
import { NuevaCuentaFormFields } from "./_sections/NuevaCuentaFormFields";

export default function TesoreriaCuentas() {
  const {
    cuentas, isLoading, isError, refetch, open, setOpen, form, setField, submit, submitting,
    deleteTarget, solicitarEliminar, cancelarEliminar, confirmarEliminar, eliminando,
  } = useTesoreriaCuentasController();
  // Sentry JAVASCRIPT-REACT-3S/3T: sólo administradores y tesorero pueden
  // escribir en `cuentas_bancarias` (RLS). El contador sólo consulta.
  const { canAdminCuentasBancarias } = usePermissions();
  const { data: saldos = [] } = useSaldosCuentas();

  return (
    <PageContainer>
      <PageHeader
        title="Cuentas bancarias"
        description={
          canAdminCuentasBancarias
            ? "Alta y administración de cuentas para conciliación"
            : "Consulta de cuentas para conciliación (sólo administradores y tesorería pueden editarlas)"
        }
        actions={
          canAdminCuentasBancarias ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
            </Button>
          ) : undefined
        }
      />

      {isLoading || isError ? (
        <AsyncBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          skeleton={<KpiGridSkeleton count={3} heightClass="h-32" desktopCols={3} />}
          errorTitle="No se pudieron cargar las cuentas bancarias"
        >
          {null}
        </AsyncBoundary>
      ) : cuentas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
          {canAdminCuentasBancarias ? "Aún no hay cuentas. Crea la primera." : "Aún no hay cuentas registradas."}
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cuentas.map((c) => (
            <CuentaBancariaCard
              key={c.id}
              cuenta={c}
              saldoActual={saldos.find((s) => s.id === c.id)?.saldo}
              canAdmin={canAdminCuentasBancarias}
              onEliminar={solicitarEliminar}
            />
          ))}
        </div>
      )}

      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        icon={Landmark}
        title="Nueva cuenta bancaria"
        description="Captura los datos de la nueva cuenta bancaria para conciliación."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={submitting}>Guardar</Button>
          </>
        }
      >
        <NuevaCuentaFormFields form={form} setField={setField} />
      </FormDialogShell>

      <ConfirmDeleteAlert
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) cancelarEliminar(); }}
        title={deleteTarget ? `¿Eliminar cuenta "${deleteTarget.alias}"?` : "¿Eliminar cuenta?"}
        description="La cuenta dejará de aparecer en conciliación. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cuenta"
        pending={eliminando}
        onConfirm={confirmarEliminar}
      />
    </PageContainer>
  );
}
