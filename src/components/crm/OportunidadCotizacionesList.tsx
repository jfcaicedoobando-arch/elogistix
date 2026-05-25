/**
 * Lista las cotizaciones vinculadas a una oportunidad (Sprint D).
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Cot {
  id: string;
  folio: string;
  estado: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  embarque_id: string | null;
}

interface Props {
  oportunidadId: string;
}

export default function OportunidadCotizacionesList({ oportunidadId }: Props) {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery<Cot[]>({
    queryKey: ["crm", "op-cotizaciones", oportunidadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("id, folio, estado, subtotal, moneda, created_at, embarque_id")
        .eq("oportunidad_id", oportunidadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cot[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Cotizaciones vinculadas ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no se ha creado ninguna cotización para esta oportunidad. Usa el botón "Crear cotización" arriba.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1">Folio</th>
                <th className="text-left">Estado</th>
                <th className="text-right">Monto</th>
                <th className="text-center">Embarque</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  className="border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/cotizaciones/${c.id}`)}
                >
                  <td className="py-1 font-medium">{c.folio}</td>
                  <td><Badge variant="outline">{c.estado}</Badge></td>
                  <td className="text-right">{formatCurrencyCompact(Number(c.subtotal ?? 0), c.moneda)}</td>
                  <td className="text-center">
                    {c.embarque_id ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${c.embarque_id}`); }}
                      >
                        <Ship className="h-3 w-3" /> Ver
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
