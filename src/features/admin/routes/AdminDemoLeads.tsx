/**
 * Lista de leads capturados desde el diálogo "Probar demo" en la landing.
 * Sólo accesible a super_admin (RLS filtra a nivel BD).
 */
import { useQuery } from "@tanstack/react-query";
import { Users2, Copy } from "lucide-react";
import { fetchDemoLeads, type DemoLead } from "@/features/admin/services/demoLeads";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPhoneMx } from "@/lib/formatters/phone";
import { formatFechaHora } from "@/lib/formatters";

import { useToast, useDocumentTitle } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { todayLocalISO } from "@/lib/date/today";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";


function toCsv(rows: DemoLead[]): string {
  const headers = [
    "fecha",
    "nombre",
    "empresa",
    "email",
    "telefono",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer",
  ];
  const esc = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.nombre,
      r.empresa,
      r.email,
      r.telefono_e164,
      r.utm_source,
      r.utm_medium,
      r.utm_campaign,
      r.referrer,
    ]
      .map(esc)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export default function AdminDemoLeads() {
  useDocumentTitle('Leads de la demo');
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.demoLeads.all, queryFn: fetchDemoLeads });
  const rows = data ?? [];

  const handleExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-leads-${todayLocalISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: text });
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Users2 className="h-6 w-6 text-primary" />}
        title="Leads de la demo"
        description={`${rows.length} contactos capturados desde la landing.`}
        actions={
          <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            Exportar CSV
          </Button>
        }
      />

      {isLoading ? (
        <EmptyStateInline loading message="Cargando…" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aún no hay leads. Cuando alguien pruebe la demo desde la landing aparecerá aquí.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Contacto</th>
                <th className="px-3 py-2 text-left">Atribución</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatFechaHora(r.created_at, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}

                  </td>
                  <td className="px-3 py-2 font-medium">{r.nombre}</td>
                  <td className="px-3 py-2">{r.empresa}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <button
                        className="flex items-center gap-1 text-left hover:text-accent"
                        onClick={() => copy(r.email)}
                      >
                        <Copy className="h-3 w-3" />
                        {r.email}
                      </button>
                      <button
                        className="flex items-center gap-1 text-left hover:text-accent"
                        onClick={() => copy(r.telefono_e164)}
                      >
                        <Copy className="h-3 w-3" />
                        {formatPhoneMx(r.telefono_e164)}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.utm_source ? (
                      <span>
                        {r.utm_source} · {r.utm_medium ?? "—"} · {r.utm_campaign ?? "—"}
                      </span>
                    ) : r.referrer ? (
                      <span>ref: {r.referrer.slice(0, 40)}</span>
                    ) : (
                      <span>directo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
