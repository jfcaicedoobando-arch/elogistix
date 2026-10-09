/**
 * Opciones del tarifario que coinciden con la solicitud. Elegir una la guarda
 * en la solicitud y la marca respondida sin esperar a Pricing.
 */
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { CargoTarifario, TarifaTarifario } from "@/features/costeo";
import { useOpcionesTarifario } from "@/features/crm/hooks/useOpcionesTarifario";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

interface Props { solicitud: SolicitudPricingRow; puedeElegir: boolean }

export function OpcionesTarifario({ solicitud: s, puedeElegir }: Props) {
  const { opciones, elegida, esFob, cargosFob, cargosLocales, isLoading, busy, elegir } = useOpcionesTarifario(s);
  const navigate = useNavigate();
  const irACotizar = (tarifaId: string) => {
    const q = new URLSearchParams({ tarifa: tarifaId });
    if (s.oportunidad_id) q.set("oportunidad", s.oportunidad_id);
    navigate(`/cotizaciones/nueva?${q.toString()}`);
  };
  const cotizar = async (id: string) => {
    if (elegida === id || await elegir(id)) irACotizar(id);
  };
  if (!elegida && s.estado !== "borrador" && s.estado !== "enviada") return null;

  return (
    <div className="space-y-2">
      <SectionHeading as="h3">{elegida ? "Opción elegida del tarifario" : "Opciones del tarifario"}</SectionHeading>
      {opciones.length === 0 && !isLoading && (
        <EmptyStateInline message="No hay tarifas vigentes que coincidan; Pricing atenderá la solicitud." />
      )}
      {opciones.map((t) => (
        <OpcionTarifarioCard key={t.id} tarifa={t}
          cargosFob={esFob ? cargosFob : []} cargosLocales={cargosLocales}
          puedeElegir={!elegida && puedeElegir} busy={busy !== null} elegir={elegir}
          puedeCotizar={puedeElegir && (!elegida || elegida === t.id)} cotizar={cotizar} />
      ))}
    </div>
  );
}

interface CardProps {
  tarifa: TarifaTarifario;
  cargosFob: CargoTarifario[];
  cargosLocales: CargoTarifario[];
  puedeElegir: boolean;
  busy: boolean;
  elegir: (id: string) => Promise<boolean>;
  puedeCotizar: boolean;
  cotizar: (id: string) => Promise<void>;
}

function OpcionTarifarioCard({ tarifa: t, cargosFob, cargosLocales, puedeElegir, busy, elegir, puedeCotizar, cotizar }: CardProps) {
  const cargos = [
    ...cargosFob.filter((c) => c.entidad_id === t.agente?.id),
    ...cargosLocales.filter((c) => c.entidad_id === t.naviera?.id),
  ];
  return (
    <Card>
      <CardContent className="grid gap-2 p-4 text-body-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Puertos: </span>{t.ruta?.origen?.name ?? "—"} → {t.ruta?.destino?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Agente / Naviera: </span>{t.agente?.nombre ?? "—"} / {t.naviera?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">{t.tipo?.code ?? ""}: </span>{formatCurrency(t.flete_base, t.moneda || "USD")}</div>
        <div><span className="text-muted-foreground">Vigencia hasta: </span>{t.vigente_hasta ? formatDate(t.vigente_hasta) : "—"}</div>
        {cargos.map((c) => (
          <div key={c.id} className="md:col-span-2 text-muted-foreground">
            + {c.concepto}: {formatCurrency(c.monto, c.moneda)} {c.unidad ?? ""}
          </div>
        ))}
        {(puedeElegir || puedeCotizar) && (
          <div className="flex flex-wrap gap-2 md:col-span-4">
            {puedeElegir && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void elegir(t.id)}>Usar esta opción</Button>
            )}
            {puedeCotizar && (
              <Button size="sm" disabled={busy} onClick={() => void cotizar(t.id)}>Cotizar con esta opción</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
