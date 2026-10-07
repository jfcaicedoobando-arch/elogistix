/**
 * Opciones del tarifario que coinciden con la solicitud. Elegir una la guarda
 * en la solicitud y la marca respondida sin esperar a Pricing.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import { hoyMx } from "@/lib/date/mx";
import { listarTarifasTarifario } from "@/features/costeo/tarifario/tarifarioService";
import { tarifasCoincidentes } from "@/features/costeo/tarifario/coincidencias";
import { aplicarTarifaTarifario, listarCargos } from "@/features/costeo/tarifario/cargosService";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

interface Props { solicitud: SolicitudPricingRow; puedeElegir: boolean }

export function OpcionesTarifario({ solicitud: s, puedeElegir }: Props) {
  const qc = useQueryClient();
  const hoy = hoyMx();
  const tarifas = useQuery({ queryKey: ["tarifario", "tarifas", false], queryFn: () => listarTarifasTarifario(false, hoy) });
  const esFob = (s.incoterm ?? "").toUpperCase() === "FOB";
  const fob = useQuery({ queryKey: ["tarifario", "cargos", "fob"], queryFn: () => listarCargos("fob"), enabled: esFob });
  const locales = useQuery({ queryKey: ["tarifario", "cargos", "locales"], queryFn: () => listarCargos("locales") });
  const [busy, setBusy] = useState<string | null>(null);

  const elegida = s.tarifa_tarifario_id;
  const opciones = elegida
    ? (tarifas.data ?? []).filter((t) => t.id === elegida)
    : tarifasCoincidentes(s, tarifas.data ?? [], hoy);
  if (!elegida && s.estado !== "borrador" && s.estado !== "enviada") return null;

  const elegir = async (id: string) => {
    setBusy(id);
    try {
      await aplicarTarifaTarifario(s.id, id);
      toast.success("Opción guardada en la solicitud");
      await qc.invalidateQueries();
    } catch {
      toast.error("No se pudo guardar la opción. Verifica que la tarifa siga vigente.");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-body font-semibold">{elegida ? "Opción elegida del tarifario" : "Opciones del tarifario"}</h3>
      {opciones.length === 0 && !tarifas.isLoading && (
        <p className="text-body-sm text-muted-foreground">No hay tarifas vigentes que coincidan; Pricing atenderá la solicitud.</p>
      )}
      {opciones.map((t) => {
        const cargosFob = esFob ? (fob.data ?? []).filter((c) => c.entidad_id === t.agente?.id) : [];
        const cargosLoc = (locales.data ?? []).filter((c) => c.entidad_id === t.naviera?.id);
        return (
          <Card key={t.id}>
            <CardContent className="grid gap-2 p-4 text-body-sm md:grid-cols-4">
              <div><span className="text-muted-foreground">Ruta: </span>{t.ruta?.origen?.name ?? "—"} → {t.ruta?.destino?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">Agente / Naviera: </span>{t.agente?.nombre ?? "—"} / {t.naviera?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">{t.tipo?.code ?? ""}: </span>{formatCurrency(t.flete_base, t.moneda || "USD")}</div>
              <div><span className="text-muted-foreground">Vigente hasta: </span>{t.vigente_hasta ? formatDate(t.vigente_hasta) : "—"}</div>
              {[...cargosFob, ...cargosLoc].map((c) => (
                <div key={c.id} className="md:col-span-2 text-muted-foreground">
                  + {c.concepto}: {formatCurrency(c.monto, c.moneda)} {c.unidad ?? ""}
                </div>
              ))}
              {!elegida && puedeElegir && (
                <div className="md:col-span-4">
                  <Button size="sm" disabled={busy !== null} onClick={() => void elegir(t.id)}>Usar esta opción</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
