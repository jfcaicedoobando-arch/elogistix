/**
 * Página de inicio del Portal del Agente. Muestra KPIs simples y atajos.
 */
import { Card } from "@/components/ui/card";
import { FileText, ShieldCheck, Ship, ClipboardCheck, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAgenteContext, useAgenteTarifas, useAgenteEmbarques } from "@/features/portal-agente/hooks";

export default function AgenteInicio() {
  const { data: ctx } = useAgenteContext();
  const { data: tarifas = [] } = useAgenteTarifas();
  const { data: embarques = [] } = useAgenteEmbarques();

  const hoy = new Date().toISOString().slice(0, 10);
  const vigentes = tarifas.filter((t) => t.estado_aprobacion === "vigente" && t.vigente_hasta >= hoy).length;
  const borradores = tarifas.filter((t) => t.estado_aprobacion === "borrador").length;
  const rechazadas = tarifas.filter((t) => t.estado_aprobacion === "rechazada").length;
  const en30 = tarifas.filter((t) => {
    if (t.estado_aprobacion !== "vigente") return false;
    const dHasta = new Date(t.vigente_hasta);
    const diff = (dHasta.getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bienvenido, ${ctx?.agenteNombre ?? "agente"}`}
        description="Desde aquí puedes mantener tus tarifas marítimas y tu carta garantía siempre al día."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<ClipboardCheck className="h-4 w-4" />} label="Tarifas vigentes" value={vigentes} />
        <KpiCard icon={<FileText className="h-4 w-4" />} label="Borradores pendientes" value={borradores} accent={borradores > 0 ? "warning" : undefined} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Vencen en 30 días" value={en30} accent={en30 > 0 ? "warning" : undefined} />
        <KpiCard icon={<Ship className="h-4 w-4" />} label="Embarques activos" value={embarques.length} />
      </div>

      {rechazadas > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-2">
          <p className="text-sm">
            Tienes <strong>{rechazadas}</strong> tarifa(s) rechazada(s) por operaciones.
            <Link to="/agente/tarifas" className="text-accent ml-1 underline">Revisarlas</Link>
          </p>
          <ul className="text-xs space-y-1 list-disc pl-5">
            {tarifas
              .filter((t) => t.estado_aprobacion === "rechazada")
              .slice(0, 3)
              .map((t) => (
                <li key={t.id}>
                  <strong>{t.puerto_origen_nombre} → {t.puerto_destino_nombre}</strong>
                  {t.motivo_rechazo ? `: ${t.motivo_rechazo}` : ""}
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickLink to="/agente/tarifas" icon={<FileText className="h-5 w-5" />} title="Mis tarifas" desc="Captura o actualiza tus tarifas marítimas. Quedan en borrador hasta que operaciones las aprueba." />
        <QuickLink to="/agente/garantias" icon={<ShieldCheck className="h-5 w-5" />} title="Carta garantía" desc="Sube tu carta garantía y mantén el tabulador de demoras actualizado." />
        <QuickLink to="/agente/embarques" icon={<Ship className="h-5 w-5" />} title="Mis embarques" desc="Consulta los embarques donde estás asignado como agente." />
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: number; accent?: "warning" }) {
  return (
    <Card className={`p-3 ${accent === "warning" ? "border-warning/40 bg-warning/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
    </Card>
  );
}

function QuickLink({
  to, icon, title, desc,
}: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:bg-muted/40 transition-colors h-full">
        <div className="flex items-center gap-2 text-accent">{icon}<span className="font-medium">{title}</span></div>
        <p className="text-xs text-muted-foreground mt-2">{desc}</p>
      </Card>
    </Link>
  );
}
