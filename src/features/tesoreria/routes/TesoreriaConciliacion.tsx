import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileSpreadsheet, Landmark } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  type MovimientoManualInput,
} from "@/features/tesoreria/domain/movimientoManual";
import { useCuentasBancarias, useMovimientos, useConciliarPago, useConciliacionResumen, useRegistrarMovimientoManual, useSaldosCuentas } from "@/features/tesoreria/hooks";
import { useAutoConciliarExactos } from "@/features/tesoreria/hooks/useAutoConciliarExactos";
import { ResumenConciliacionCards } from "@/features/tesoreria/components/ResumenConciliacionCards";
import { PanelConciliacionMovimiento } from "@/features/tesoreria/components/PanelConciliacionMovimiento";
import type { MovimientoBBVA } from "@/features/tesoreria/services";


import { PageContainer } from "@/components/shared/PageContainer";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { crearMovimientoColumns } from "./_sections/movimientoColumns";
import { DetallePagoSheet } from "@/features/tesoreria/components/DetallePagoSheet";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { MovimientoManualDialog } from "./_sections/MovimientoManualDialog";
import { ConciliacionToolbar } from "./_sections/ConciliacionToolbar";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useFiltroUrl } from "@/hooks/shared/useFiltroUrl";
import { useImportarEstadoCuenta } from "@/features/tesoreria/hooks/useImportarEstadoCuenta";

const ESTADOS_MOVIMIENTO = ["Pendiente", "Conciliado", "Ignorado", "todos"] as const;



export default function TesoreriaConciliacion() {
  const { data: cuentas = [] } = useCuentasBancarias();
  const { canCapturarMovimientoBancario } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cuentaId, setCuentaIdState] = useState<string>(searchParams.get("cuenta") ?? "");
  const setCuentaId = (id: string) => {
    setCuentaIdState(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("cuenta", id); else next.delete("cuenta");
      return next;
    }, { replace: true });
  };
  // M8 (Ola 8): el estado del movimiento también viaja en la URL.
  const [estado, setEstado] = useFiltroUrl<"Pendiente" | "Conciliado" | "Ignorado" | "todos">(
    "estado",
    ESTADOS_MOVIMIENTO,
    "Pendiente",
  );
  const [sel, setSel] = useState<MovimientoBBVA | null>(null);
  const [refPago, setRefPago] = useState<RefPago | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<Partial<MovimientoManualInput>>({
    tipo: "cargo",
  });

  const { data: movs = [], isLoading, isError: movsError, refetch: refetchMovs } = useMovimientos(cuentaId ? { cuenta_bancaria_id: cuentaId, estado } : null);
  const { data: resumen, isLoading: resumenLoading } = useConciliacionResumen(cuentaId || null);
  const { data: saldos = [] } = useSaldosCuentas();
  const conciliarPago = useConciliarPago();
  const registrarManual = useRegistrarMovimientoManual();
  const { fileRef, handleFile, importando } = useImportarEstadoCuenta(cuentaId);
  const monedaCuenta = cuentas.find((c) => c.id === cuentaId)?.moneda ?? "MXN";
  const columns = useMemo(() => crearMovimientoColumns(setRefPago, monedaCuenta), [monedaCuenta]);
  const { isAutoConciliando, handleConciliarExactos } = useAutoConciliarExactos(movs, conciliarPago.mutateAsync);

  const abrirModalManual = () => {
    setManualForm({ cuentaBancariaId: cuentaId || undefined, fecha: undefined, concepto: "", referencia: "", tipo: "cargo", monto: undefined });
    setManualOpen(true);
  };

  const setManualField = <K extends keyof MovimientoManualInput>(key: K, value: MovimientoManualInput[K]) =>
    setManualForm((prev) => ({ ...prev, [key]: value }));

  const handleGuardarManual = async () => {
    const { cuentaBancariaId, fecha, concepto, referencia, tipo, monto } = manualForm as MovimientoManualInput;
    await registrarManual.mutateAsync({
      cuentaBancariaId,
      fecha,
      concepto,
      referencia,
      cargo: tipo === "cargo" ? monto : 0,
      abono: tipo === "abono" ? monto : 0,
    });
    setManualOpen(false);
  };

  const cuentaActual = cuentas.find((c) => c.id === cuentaId);
  const pendientesCount = movs.filter((m) => m.estado_conciliacion === "Pendiente").length;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Conciliación bancaria"
        description="Importa el estado de cuenta y empareja con CxC/CxP"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`${ROUTES.TESORERIA_ESTADO_CUENTA}${cuentaId ? `?cuenta=${cuentaId}` : ""}`}>
              <Landmark className="h-4 w-4" aria-hidden /> Ver estado de cuenta
            </Link>
          </Button>
        }
      />


      <ConciliacionToolbar
        cuentas={cuentas}
        cuentaId={cuentaId}
        onCuentaChange={setCuentaId}
        estado={estado}
        onEstadoChange={setEstado}
        pendientesCount={pendientesCount}
        isAutoConciliando={isAutoConciliando}
        onConciliarExactos={handleConciliarExactos}
        onAbrirManual={abrirModalManual}
        fileRef={fileRef}
        onFile={handleFile}
        importando={importando}
        puedeCapturar={canCapturarMovimientoBancario}
      />

      {!cuentaId ? (
        <Card>
          <CardContent density="compact">
            <EmptyStateInline icon={FileSpreadsheet} message="Selecciona una cuenta para empezar a conciliar." />
          </CardContent>
        </Card>
      ) : (
        <>
        <ResumenConciliacionCards
          resumen={resumen}
          moneda={cuentaActual?.moneda ?? "MXN"}
          saldo={saldos.find((s) => s.id === cuentaId)?.saldo}
          isLoading={resumenLoading}
        />
        <div className="grid lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2 space-y-1">
            <div className="text-body-sm text-muted-foreground px-1 flex justify-between">
              <span>{movs.length} movimientos · {cuentaActual?.alias}</span>
            </div>
            <VirtualDataTable
              columns={columns}
              data={movs}
              rowKey={(m) => m.id}
              onRowClick={setSel}
              rowClassName={(m) => (sel?.id === m.id ? "bg-accent/10" : "")}
              isLoading={isLoading}
              isError={movsError}
              onRetry={() => void refetchMovs()}
              emptyMessage="No hay movimientos."
              maxHeight={560}
            />
          </div>
          <div className="lg:col-span-1">
            <PanelConciliacionMovimiento movimiento={sel} onClose={() => setSel(null)} moneda={monedaCuenta} />
          </div>
        </div>
        </>
      )}

      <MovimientoManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        cuentas={cuentas}
        manualForm={manualForm}
        setManualField={setManualField}
        onGuardar={handleGuardarManual}
        isPending={registrarManual.isPending}
      />

      {refPago ? (
        <DetallePagoSheet
          ref_pago={refPago}
          onOpenChange={(open) => { if (!open) setRefPago(null); }}
        />
      ) : null}
    </PageContainer>
  );
}
