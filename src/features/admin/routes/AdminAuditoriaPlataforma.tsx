/**
 * Auditoría de plataforma (dueño Libre Carga) — placeholder.
 *
 * 13.21.26: separación conceptual del módulo de Auditoría:
 *   - `/auditoria` → Auditoría operativa (por tenant, hallazgos en embarques).
 *   - `/admin/auditoria` → Auditoría de plataforma (esta página, superadmin).
 *
 * Por ahora es un placeholder con los KPIs previstos para no romper el
 * scope del MVP. La implementación real se planificará en una iteración
 * posterior cuando se priorice frente al backlog del dueño.
 */
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackfillLegacyCard } from "@/features/admin/components/BackfillLegacyCard";
import { MigrarRolesLegacyCard } from "@/features/admin/components/MigrarRolesLegacyCard";

const KPIS_PREVISTOS = [
  "Uso por organización (embarques, cotizaciones, usuarios activos).",
  "Errores recientes capturados por Sentry y `app_logs` agregados por org.",
  "Snapshots globales de auditoría operativa (tendencia cross-tenant).",
  "Integridad multi-tenant: detección de filas sin `organization_id` o huérfanas.",
  "Estado de jobs programados (snapshot diario, weekly digest, cxc-recordatorios).",
];

export default function AdminAuditoriaPlataforma() {
  return (
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Auditoría de plataforma"
        description="Salud global de Libre Carga: uso por organización, errores e integridad cross-tenant."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulo en construcción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Este módulo está reservado para el dueño de Libre Carga. La{" "}
            <strong>Auditoría operativa</strong> que ven los clientes vive en{" "}
            <code className="rounded bg-muted px-1 py-0.5">/auditoria</code> y
            opera por organización con RLS.
          </p>
          <p className="font-medium text-foreground">KPIs previstos:</p>
          <ul className="list-disc pl-5 space-y-1">
            {KPIS_PREVISTOS.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <BackfillLegacyCard />
    </PageContainer>
  );
}
