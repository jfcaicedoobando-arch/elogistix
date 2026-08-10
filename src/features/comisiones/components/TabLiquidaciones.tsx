import { useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useLiquidaciones } from "@/features/comisiones/hooks";
import { useAuth } from "@/lib/contexts/AuthContext";
import { DialogGenerarLiquidacion } from "./DialogGenerarLiquidacion";
import { DialogRegistrarPagoLiquidacion } from "./DialogRegistrarPagoLiquidacion";
import type { LiquidacionRow } from "@/features/comisiones/services";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface VendedoraOpt { id: string; nombre: string }

export function TabLiquidaciones({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  const { data: liquidaciones = [], isLoading } = useLiquidaciones();
  const [genOpen, setGenOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState<LiquidacionRow | null>(null);
  // Ola 4 · N28: mismos roles que la RPC/RLS — gerentes son sólo lectura.
  const { effectiveRole } = useAuth();
  const puedeGestionar =
    effectiveRole != null &&
    ["admin", "admin_org", "super_admin", "contador", "tesorero"].includes(effectiveRole);

  return (
    <div className="space-y-4">
      {puedeGestionar && (
        <div className="flex justify-end">
          <Button onClick={() => setGenOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Generar liquidación
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">
              <EmptyStateInline loading message="Cargando…" />
            </div>
          ) : liquidaciones.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sin liquidaciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Periodo</th>
                  <th className="p-2">Vendedora</th>
                  <th className="p-2 text-right">Total MXN</th>
                  <th className="p-2">Fecha pago</th>
                  <th className="p-2">Referencia</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l, i) => {
                  const v = vendedoras.find((x) => x.id === l.vendedora_id);
                  return (
                    <tr key={l.id} className={i % 2 ? "bg-muted/20" : ""}>
                      <td className="p-2 font-mono text-xs">{l.periodo}</td>
                      <td className="p-2">{v?.nombre ?? l.vendedora_id}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">
                        {formatCurrency(Number(l.total_mxn), "MXN")}
                      </td>
                      <td className="p-2">
                        {l.fecha_pago
                          ? formatDate(l.fecha_pago)
                          : <span className="text-muted-foreground italic">pendiente</span>}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{l.referencia ?? "—"}</td>
                      <td className="p-2 text-right">
                        {!l.fecha_pago && puedeGestionar && (
                          <Button size="sm" variant="outline" onClick={() => setPagoOpen(l)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Registrar pago
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <DialogGenerarLiquidacion open={genOpen} onOpenChange={setGenOpen} vendedoras={vendedoras} />
      <DialogRegistrarPagoLiquidacion
        open={!!pagoOpen}
        onOpenChange={(o) => !o && setPagoOpen(null)}
        liq={pagoOpen}
      />
    </div>
  );
}
