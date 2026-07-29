import { Landmark, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { formatCurrency } from "@/lib/formatters";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  useTesoreriaCuentasController,
  type Moneda,
} from "@/features/tesoreria/hooks/useTesoreriaCuentasController";
import { usePermissions } from "@/hooks/shared/usePermissions";

export default function TesoreriaCuentas() {
  const {
    cuentas, isLoading, open, setOpen, form, setField, submit, submitting,
    deleteTarget, solicitarEliminar, cancelarEliminar, confirmarEliminar, eliminando,
  } = useTesoreriaCuentasController();
  // Sentry JAVASCRIPT-REACT-3S/3T: `tesorero` y `contador` sólo tienen lectura
  // en `cuentas_bancarias` (RLS). Antes veían los botones y chocaban con 42501.
  const { canAdminTenant } = usePermissions();

  return (
    <PageContainer>
      <PageHeader
        title="Cuentas bancarias"
        description={
          canAdminTenant
            ? "Alta y administración de cuentas para conciliación"
            : "Consulta de cuentas para conciliación (sólo administradores pueden editarlas)"
        }
        actions={
          canAdminTenant ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <KpiGridSkeleton count={3} heightClass="h-32" desktopCols={3} />
      ) : cuentas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
          {canAdminTenant ? "Aún no hay cuentas. Crea la primera." : "Aún no hay cuentas registradas."}
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cuentas.map((c) => (
            <Card key={c.id} className={!c.activa ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.alias}</p>
                    <p className="text-xs text-muted-foreground">{c.banco} · {c.moneda}</p>
                  </div>
                  {canAdminTenant && (
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => solicitarEliminar(c.id, c.alias)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {c.numero_cuenta && <p className="text-xs">Cuenta: <span className="font-mono">{c.numero_cuenta}</span></p>}
                {c.clabe && <p className="text-xs">CLABE: <span className="font-mono">{c.clabe}</span></p>}
                <p className="text-sm pt-2">Saldo inicial: <span className="tabular-nums font-medium">{formatCurrency(Number(c.saldo_inicial), c.moneda)}</span></p>
                {!c.activa && <p className="text-xs text-muted-foreground italic">Cuenta inactiva</p>}
              </CardContent>
            </Card>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Banco</Label>
            <Input value={form.banco} onChange={(e) => setField("banco", e.target.value)} />
          </div>
          <div>
            <Label>Alias *</Label>
            <Input value={form.alias} onChange={(e) => setField("alias", e.target.value)} placeholder="BBVA Cheques MXN" />
          </div>
          <div>
            <Label>Número de cuenta</Label>
            <Input value={form.numero} onChange={(e) => setField("numero", e.target.value)} />
          </div>
          <div>
            <Label>CLABE</Label>
            <Input value={form.clabe} onChange={(e) => setField("clabe", e.target.value)} />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={form.moneda} onValueChange={(v) => setField("moneda", v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Saldo inicial</Label>
            <Input type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setField("saldoInicial", Number(e.target.value))} />
          </div>
        </div>
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
