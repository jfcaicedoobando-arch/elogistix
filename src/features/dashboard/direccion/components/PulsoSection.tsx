/**
 * Sección Pulso del negocio: activos, alertas, fiscal.
 */
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Ship } from "lucide-react";
import type { PulsoKpis } from "@/features/dashboard/direccion/services/tipos";

function Semaforo({ ok }: { ok: boolean }) {
  const Icon = ok ? CheckCircle2 : AlertCircle;
  const color = ok ? "text-emerald-600" : "text-amber-600";
  return <Icon className={`h-5 w-5 ${color}`} aria-hidden />;
}

export function PulsoSection({ pulso }: { pulso: PulsoKpis }) {
  const alertasCount = pulso.demoras + pulso.arribos_7d + (pulso.documentos_vencidos ?? 0);
  const fiscalOk = pulso.acuses_pendientes === 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Embarques activos</p>
          <Ship className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{pulso.embarques_activos}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {pulso.embarques_por_estado.slice(0, 4).map((e) => (
            <li key={e.estado} className="flex justify-between">
              <span>{e.estado}</span>
              <span className="tabular-nums">{e.total}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Alertas operativas</p>
          <Semaforo ok={alertasCount === 0} />
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          <li className="flex justify-between">
            <span>Demoras</span>
            <span className={`tabular-nums ${pulso.demoras > 0 ? "text-destructive font-medium" : ""}`}>{pulso.demoras}</span>
          </li>
          <li className="flex justify-between">
            <span>Arribos próximos 7 días</span>
            <span className="tabular-nums">{pulso.arribos_7d}</span>
          </li>
          <li className="flex justify-between text-muted-foreground italic">
            <span>Documentos vencidos</span>
            <span>sin datos</span>
          </li>
        </ul>
      </Card>

      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Estatus fiscal</p>
          <Semaforo ok={fiscalOk} />
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          <li className="flex justify-between">
            <span>CFDI timbrados este mes</span>
            <span className="tabular-nums">{pulso.cfdi_timbrados_mes}</span>
          </li>
          <li className="flex justify-between">
            <span>Acuses de cancelación pendientes</span>
            <span className={`tabular-nums ${pulso.acuses_pendientes > 0 ? "text-amber-600 font-medium" : ""}`}>
              {pulso.acuses_pendientes}
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
