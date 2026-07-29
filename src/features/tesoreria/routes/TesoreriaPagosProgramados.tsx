import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPagosProgramables,
  type FacturaProgramableRow,
} from "@/features/tesoreria/services/pagosProgramados";
import { agruparPorSemana, type FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import { tesoreria as tesoreriaKeys } from "@/features/tesoreria/queryKeys";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { defineColumns } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { PageSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCuentasBancarias } from "@/features/tesoreria/hooks/useTesoreriaCuentas";
import { useEjecutarPagoProgramado } from "@/features/tesoreria/hooks/useEjecutarPagoProgramado";
import { formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { EjecutarPagoDialog, type FormPago } from "./_sections/EjecutarPagoDialog";
import { PagosProgramadosTablas } from "./_sections/PagosProgramadosTablas";

type FiltroBandeja = "todas" | "programadas" | "treinta_dias";

/** Filtra la lista completa de facturas programables según el filtro explícito del usuario. */
function filtrarProgramables(data: FacturaProgramableRow[], filtro: FiltroBandeja): FacturaProgramable[] {
  let rows = data;
  if (filtro === "programadas") rows = rows.filter((r) => r.fecha_programada_pago);
  if (filtro === "treinta_dias") {
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    rows = rows.filter((r) => {
      const f = r.fecha_programada_pago ?? r.fecha_vencimiento;
      return f && new Date(`${f}T00:00:00`) <= limite;
    });
  }
  return rows as FacturaProgramable[];
}

export default function TesoreriaPagosProgramados() {
  // B-030: fetch directo sin filtro implícito de estado (antes la RPC
  // `cxp_por_pagar` ocultaba captura/Borrador/por aprobar con fecha).
  const { data = [], isLoading } = useQuery({
    queryKey: tesoreriaKeys.pagosProgramables,
    queryFn: fetchPagosProgramables,
    staleTime: 30_000,
  });

  // Filtro EXPLÍCITO del usuario — por defecto se muestra todo.
  const [filtro, setFiltro] = useState<FiltroBandeja>("todas");
  const [facturaPago, setFacturaPago] = useState<FacturaProgramable | null>(null);
  const [form, setForm] = useState<FormPago>({
    cuentaBancariaId: "", fecha: formatDateOnlyLocal(new Date()), monto: 0, metodoPago: "Transferencia", referencia: "",
  });

  const { data: cuentas = [] } = useCuentasBancarias();
  const ejecutarPago = useEjecutarPagoProgramado();

  const cuentasCompatibles = useMemo(
    () => cuentas.filter((c) => c.moneda === facturaPago?.moneda),
    [cuentas, facturaPago],
  );

  const abrirDialogoPago = (f: FacturaProgramable) => {
    setFacturaPago(f);
    setForm({
      cuentaBancariaId: "",
      fecha: formatDateOnlyLocal(new Date()),
      monto: f.saldo,
      metodoPago: "Transferencia",
      referencia: "",
    });
  };

  const setField = <K extends keyof FormPago>(key: K, value: FormPago[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleEjecutar = async () => {
    if (!facturaPago) return;
    await ejecutarPago.mutateAsync({
      facturaId: facturaPago.id,
      cuentaBancariaId: form.cuentaBancariaId,
      fecha: form.fecha,
      monto: form.monto,
      metodoPago: form.metodoPago,
      referencia: form.referencia,
    });
    setFacturaPago(null);
  };

  const programables = useMemo(() => filtrarProgramables(data as FacturaProgramableRow[], filtro), [data, filtro]);

  const semanas = useMemo(() => agruparPorSemana(programables), [programables]);
  // B-030: pendientes sin fecha efectiva — antes se descartaban en silencio.
  const sinFecha = useMemo(
    () => programables.filter((r) => !r.fecha_programada_pago && !r.fecha_vencimiento),
    [programables],
  );

  const columns = useMemo(() => defineColumns<FacturaProgramable>([
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "",
      meta: { width: "min-w-[180px]", className: "font-medium truncate" },
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio_proveedor ?? "",
      meta: { width: "w-[120px]", className: "font-mono text-xs" },
    },
    {
      id: "fecha",
      header: "Fecha (Venc/Prog)",
      meta: { width: "w-[150px]", className: "text-xs" },
      cell: ({ row }) => {
        const r = row.original;
        const fecha = r.fecha_programada_pago ?? r.fecha_vencimiento;
        return (
          <div className="flex items-center gap-1.5">
            <span>{fecha ? formatDate(fecha) : "—"}</span>
            {r.fecha_programada_pago && (
              <ToneBadge tone="info" size="sm">Prog.</ToneBadge>
            )}
          </div>
        );
      },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "monto",
        header: "Monto",
        accessor: (r) => r.total,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[120px]", align: "right" },
    },
    {
      ...moneyColumn<FacturaProgramable>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => r.saldo,
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[120px]", align: "right", className: "font-semibold" },
    },
    {
      id: "acciones",
      header: "",
      meta: { width: "w-[130px]", align: "right" },
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => abrirDialogoPago(row.original)}>
          <Wallet className="h-3.5 w-3.5 mr-1.5" /> Ejecutar pago
        </Button>
      ),
    },
  ]), []);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Pagos programados" description="Bandeja semanal de Tesorería." />
        <PageSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pagos programados"
        description="Bandeja semanal de Tesorería. Agrupación por fecha programada (o vencimiento)."
      />

      {/* B-030: filtro explícito y visible. Default: "Todas" para no ocultar
          facturas silenciosamente como hacía la RPC anterior. */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mostrar:</span>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroBandeja)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las pendientes</SelectItem>
            <SelectItem value="programadas">Solo con pago programado</SelectItem>
            <SelectItem value="treinta_dias">Vencen en 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PagosProgramadosTablas semanas={semanas} sinFecha={sinFecha} columns={columns} />

      <EjecutarPagoDialog
        facturaPago={facturaPago}
        onClose={() => setFacturaPago(null)}
        cuentasCompatibles={cuentasCompatibles}
        form={form}
        setField={setField}
        onEjecutar={handleEjecutar}
        isPending={ejecutarPago.isPending}
      />
    </PageContainer>
  );
}
