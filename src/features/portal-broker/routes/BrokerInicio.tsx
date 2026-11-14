/**
 * Portal de Brokers · Mis empresas: empresas que trae el broker y la etapa
 * de sus oportunidades (sólo lectura).
 */
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/shared";
import { useBrokerEmpresas } from "../hooks/useBrokerEmpresas";

export default function BrokerInicio() {
  useDocumentTitle("Mis empresas");
  const q = useBrokerEmpresas();
  const empresas = q.data ?? [];

  return (
    <>
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-primary" />}
        title="Mis empresas"
        description="Empresas que trajiste y la etapa en la que va cada oportunidad."
      />
      <CargaGuard
        isLoading={q.isLoading}
        isError={q.isError}
        onRetry={q.refetch}
        errorTitle="No se pudieron cargar tus empresas"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
        {empresas.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">Aún no tienes empresas asignadas.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {empresas.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{e.nombre}</p>
                    <Badge variant="outline">{e.estado}</Badge>
                  </div>
                  <p className="text-body-sm text-muted-foreground">{e.organizacion}</p>
                  {e.oportunidades.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">Sin oportunidades todavía.</p>
                  ) : (
                    <ul className="space-y-1">
                      {e.oportunidades.map((o, i) => (
                        <li key={`${o.nombre}-${i}`} className="flex justify-between gap-2 text-body-sm">
                          <span className="truncate">{o.nombre}</span>
                          <Badge variant="secondary">{o.etapa}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CargaGuard>
    </>
  );
}
