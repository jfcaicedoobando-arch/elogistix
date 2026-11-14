/** Comisiones de brokers: devengado por broker, liquidación mensual y pago. */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { formatCurrency } from "@/lib/formatters/numbers";
import {
  useLiquidacionesBroker, useLiquidarBroker, usePagarLiquidacionBroker, useResumenComisionesBroker,
} from "@/features/admin/hooks/useBrokerComisiones";

const mesActual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date());
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const mxn = (n: number) => formatCurrency(Number(n), "MXN");

export function BrokersComisiones() {
  const [periodo, setPeriodo] = useState(mesActual);
  const [pagar, setPagar] = useState<string | null>(null);
  const resumen = useResumenComisionesBroker();
  const liqs = useLiquidacionesBroker();
  const liquidar = useLiquidarBroker();
  const pago = usePagarLiquidacionBroker();
  const nombre = (id: string) => resumen.data?.find((r) => r.broker_id === id)?.broker ?? "";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-h4">Comisiones de brokers</h3>
        <label className="flex items-center gap-2 text-body-sm">
          Mes a liquidar
          <Input type="month" className="w-40" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Broker</TableHead>
            <TableHead className="text-right">Devengado</TableHead>
            <TableHead className="text-right">Liquidado por pagar</TableHead>
            <TableHead className="text-right">Pagado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(resumen.data ?? []).map((r) => (
            <TableRow key={r.broker_id}>
              <TableCell className="font-medium">{r.broker}</TableCell>
              <TableCell className="text-right tabular-nums">{mxn(r.devengado_mxn)}</TableCell>
              <TableCell className="text-right tabular-nums">{mxn(r.liquidado_pendiente_mxn)}</TableCell>
              <TableCell className="text-right tabular-nums">{mxn(r.pagado_mxn)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" disabled={Number(r.devengado_mxn) <= 0 || liquidar.isPending}
                  onClick={() => liquidar.mutate({ brokerId: r.broker_id, periodo })}>Liquidar mes</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(liqs.data ?? []).map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-body-sm">
          <span>{nombre(l.broker_id)} · {l.periodo} · {mxn(l.total_mxn)}</span>
          <Button size="sm" onClick={() => setPagar(l.id)}>Marcar pagada</Button>
        </div>
      ))}
      <ReasonDialog open={!!pagar} onOpenChange={(o) => { if (!o) setPagar(null); }}
        title="Registrar pago de liquidación" description="Se registra con fecha de hoy."
        label="Referencia del pago" placeholder="SPEI / transferencia" confirmLabel="Marcar pagada" minLength={3}
        pending={pago.isPending}
        onConfirm={async (ref) => {
          if (!pagar) return;
          await pago.mutateAsync({ id: pagar, fecha: hoy(), referencia: ref });
          setPagar(null);
        }} />
    </section>
  );
}
