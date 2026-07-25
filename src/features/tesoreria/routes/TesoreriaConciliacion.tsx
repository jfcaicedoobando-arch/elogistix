import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCuentasBancarias, useMovimientos, useImportarMovimientos, useConciliarPago } from "@/features/tesoreria/hooks";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { parseEstadoCuentaBBVA } from "@/features/tesoreria/domain/import/bbva";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PanelConciliacionMovimiento } from "@/features/tesoreria/components/PanelConciliacionMovimiento";
import type { MovimientoBBVA } from "@/features/tesoreria/services";
import { sugerirCandidatos } from "@/features/tesoreria/services/sugerirCandidatos";
import { encontrarCandidatosExactos, seleccionarMatchUnico } from "@/features/tesoreria/domain/conciliacionMatcher";

import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { PageContainer } from "@/components/shared/PageContainer";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "bg-warning/10 text-warning border-warning/20",
  Conciliado: "bg-success/10 text-success border-success/20",
  Ignorado: "bg-muted text-muted-foreground border-border",
};

const movimientoColumns: ColumnDef<MovimientoBBVA, unknown>[] = defineColumns<MovimientoBBVA>([
  {
    id: "fecha",
    header: "Fecha",
    accessorFn: (m) => m.fecha,
    cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatDate(row.original.fecha)}</span>,
  },
  {
    id: "concepto",
    header: "Concepto",
    accessorFn: (m) => m.concepto,
    cell: ({ row }) => (
      <span className="block max-w-[280px] truncate" title={row.original.concepto}>{row.original.concepto}</span>
    ),
  },
  {
    id: "cargo",
    header: "Cargo",
    accessorFn: (m) => m.cargo,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-destructive">
        {Number(row.original.cargo) > 0 ? formatCurrency(Number(row.original.cargo), "MXN") : ""}
      </span>
    ),
  },
  {
    id: "abono",
    header: "Abono",
    accessorFn: (m) => m.abono,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-success">
        {Number(row.original.abono) > 0 ? formatCurrency(Number(row.original.abono), "MXN") : ""}
      </span>
    ),
  },
  {
    id: "estado",
    header: "Estado",
    accessorFn: (m) => m.estado_conciliacion,
    meta: { width: "w-24" },
    cell: ({ row }) => (
      <Badge variant="outline" className={`text-2xs ${ESTADO_COLOR[row.original.estado_conciliacion]}`}>
        {row.original.estado_conciliacion}
      </Badge>
    ),
  },
]) as ColumnDef<MovimientoBBVA, unknown>[];

export default function TesoreriaConciliacion() {
  const { data: cuentas = [] } = useCuentasBancarias();
  const [cuentaId, setCuentaId] = useState<string>("");
  const [estado, setEstado] = useState<"Pendiente" | "Conciliado" | "Ignorado" | "todos">("Pendiente");
  const [sel, setSel] = useState<MovimientoBBVA | null>(null);
  const [isAutoConciliando, setIsAutoConciliando] = useState(false);

  const { data: movs = [], isLoading } = useMovimientos(cuentaId ? { cuenta_bancaria_id: cuentaId, estado } : null);
  const importar = useImportarMovimientos();
  const conciliarPago = useConciliarPago();
  const fileRef = useRef<HTMLInputElement>(null);
  const columns = useMemo(() => movimientoColumns, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cuentaId) {
      if (!cuentaId) notifyError(toast, { title: "Selecciona una cuenta primero", method: "PAGES_TESORERIA_TESORERIACONCILIACION_1" });
      return;
    }
    try {
      toast.message("Procesando archivo...");
      const movimientos = await parseEstadoCuentaBBVA(file);
      if (movimientos.length === 0) return notifyError(toast, { title: "No se encontraron movimientos válidos", method: "PAGES_TESORERIA_TESORERIACONCILIACION_2" });
      const res = await importar.mutateAsync({ cuentaId, movimientos });
      toast.success(`Importados ${res.nuevos} nuevos / ${res.duplicados} duplicados ignorados`);
    } catch (err) {
      notifyError(toast, { title: (err as Error).message, error: err, method: "PAGES_TESORERIA_TESORERIACONCILIACION_3" });
      reportCaughtError(err, { feature: "tesoreria", op: "importar_movimientos_bbva" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConciliarExactos = async () => {
    if (!movs.length) return;
    setIsAutoConciliando(true);
    let conciliados = 0;
    let revision = 0;

    const pendientes = movs.filter((m) => m.estado_conciliacion === "Pendiente");

    for (const m of pendientes) {
      try {
        const candidatos = await sugerirCandidatos(m);
        const exactos = encontrarCandidatosExactos(m, candidatos);
        const unico = seleccionarMatchUnico(exactos);

        if (unico) {
          // Usamos mutateAsync para esperar el resultado antes de contar éxito
          await conciliarPago.mutateAsync({
            movId: m.id,
            tipo: unico.tipo,
            pagoId: unico.pago_id,
          });
          conciliados++;
        } else {
          revision++;
        }
      } catch (err) {
        // Falló el guard o la red, cuenta como revisión
        revision++;
      }
    }

    if (conciliados > 0) {
      notifySuccess(toast, {
        title: `${conciliados} movimientos conciliados automáticamente`,
        description: revision > 0 ? `${revision} requieren revisión manual` : undefined,
      });
    } else if (revision > 0) {
      notifyWarning(toast, {
        title: "No se encontraron matches exactos únicos",
        description: `${revision} movimientos pendientes requieren revisión`,
      });
    }
    setIsAutoConciliando(false);
  };

  const cuentaActual = cuentas.find((c) => c.id === cuentaId);

  return (
    <PageContainer>
      <PageHeader
        title="Conciliación bancaria"
        description="Importa el estado de cuenta y empareja con CxC/CxP"
      />

      <Card>
        <CardContent density="compact" className="flex flex-wrap gap-3 items-center">
          <Select value={cuentaId} onValueChange={setCuentaId}>
            <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Selecciona cuenta..." /></SelectTrigger>
            <SelectContent>
              {cuentas.length === 0
                ? <SelectItem value="__sin" disabled>No hay cuentas activas</SelectItem>
                : cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco} · {c.alias} ({c.moneda})</SelectItem>)
              }
            </SelectContent>
          </Select>

          <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)} disabled={!cuentaId}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendiente">Pendientes</SelectItem>
              <SelectItem value="Conciliado">Conciliados</SelectItem>
              <SelectItem value="Ignorado">Ignorados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />
          
          <Button
            variant="outline"
            onClick={handleConciliarExactos}
            disabled={!cuentaId || isAutoConciliando || movs.filter(m => m.estado_conciliacion === "Pendiente").length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2 text-primary" />
            {isAutoConciliando ? "Conciliando..." : "Conciliar exactos"}
          </Button>

          <input
            ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={!cuentaId || importar.isPending}>
            <Upload className="h-4 w-4 mr-2" />
            {importar.isPending ? "Importando..." : "Importar XLSX/CSV"}
          </Button>
        </CardContent>
      </Card>

      {!cuentaId ? (
        <Card><CardContent density="compact" className="p-8 text-center text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-30" />
          Selecciona una cuenta para empezar a conciliar.
        </CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-1">
            <div className="text-xs text-muted-foreground px-1 flex justify-between">
              <span>{movs.length} movimientos · {cuentaActual?.alias}</span>
            </div>
            <VirtualDataTable
              columns={columns}
              data={movs}
              rowKey={(m) => m.id}
              onRowClick={setSel}
              rowClassName={(m) => (sel?.id === m.id ? "bg-accent/10" : "")}
              isLoading={isLoading}
              emptyMessage="No hay movimientos."
              maxHeight={560}
            />
          </div>
          <div className="lg:col-span-1">
            <PanelConciliacionMovimiento movimiento={sel} onClose={() => setSel(null)} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
