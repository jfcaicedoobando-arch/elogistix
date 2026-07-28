/**
 * Página de inicio del Portal del Agente. Muestra KPIs simples y atajos.
 * v13.226.0 (Lote 6): migrado a `KpiCard` compartido + Title Case + icon en PageHeader.
 */
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, ShieldCheck, Ship, ClipboardCheck, Clock, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { useAgenteContext, useAgenteTarifas, useAgenteEmbarques } from "@/features/portal-agente/hooks";
import { ESTADOS_ACTIVOS } from "@/features/embarques/constants/embarqueConstants";
import { ROUTES } from "@/constants/routes";
import { todayLocalISO } from "@/lib/date/today";

// B-087: "vigente" = aprobada + estado derivado vigente (no reemplazada) +
// no vencida por fecha — mismo criterio que `get_top_tarifas` (FIX B-079).
const esVigenteReal = (t: { estado_aprobacion: string; estado: string; vigente_hasta: string }, hoy: string) =>
  t.estado_aprobacion === "vigente" && t.estado === "vigente" && t.vigente_hasta >= hoy;

export default function AgenteInicio() {
  const { data: ctx } = useAgenteContext();
  const { data: tarifas = [] } = useAgenteTarifas();
  const { data: embarques = [] } = useAgenteEmbarques();

  const hoy = todayLocalISO();
  const vigentes = tarifas.filter((t) => esVigenteReal(t, hoy)).length;
  const borradores = tarifas.filter((t) => t.estado_aprobacion === "borrador").length;
  const rechazadas = tarifas.filter((t) => t.estado_aprobacion === "rechazada").length;
  const en30 = tarifas.filter((t) => {
    if (!esVigenteReal(t, hoy)) return false;
    const dHasta = new Date(t.vigente_hasta);
    const diff = (dHasta.getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;
  // B-094: "activos" excluye Cerrado/Cancelado/Borrador — constante canónica.
  const embarquesActivos = embarques.filter((e) =>
    (ESTADOS_ACTIVOS as readonly string[]).includes(e.estado),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="h-6 w-6 text-accent" />}
        title="Inicio"
        description={`Bienvenido, ${ctx?.agenteNombre ?? "agente"}. Desde aquí puedes mantener tus tarifas marítimas y tu carta garantía siempre al día.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardCheck} label="Tarifas vigentes" value={vigentes} />
        <KpiCard icon={FileSpreadsheet} label="Borradores pendientes" value={borradores} variant={borradores > 0 ? "warning" : "default"} />
        <KpiCard icon={Clock} label="Vencen en 30 días" value={en30} variant={en30 > 0 ? "warning" : "default"} />
        <KpiCard icon={Ship} label="Embarques activos" value={embarquesActivos} />
      </div>

      {rechazadas > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-2">
          <p className="text-sm">
            Tienes <strong>{rechazadas}</strong> tarifa(s) rechazada(s) por operaciones.
            <Link to={ROUTES.AGENTE_TARIFAS} className="text-accent ml-1 underline">Revisarlas</Link>
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
        <QuickLink to={ROUTES.AGENTE_TARIFAS} icon={<FileSpreadsheet className="h-5 w-5" />} title="Mis tarifas" desc="Captura o actualiza tus tarifas marítimas. Quedan en borrador hasta que operaciones las aprueba." />
        <QuickLink to={ROUTES.AGENTE_GARANTIAS} icon={<ShieldCheck className="h-5 w-5" />} title="Carta garantía" desc="Sube tu carta garantía y mantén el tabulador de demoras actualizado." />
        <QuickLink to={ROUTES.AGENTE_EMBARQUES} icon={<Ship className="h-5 w-5" />} title="Mis embarques" desc="Consulta los embarques donde estás asignado como agente." />
      </div>
    </div>
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
