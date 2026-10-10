/**
 * Paso 1 de una cotización nueva: si la empresa tiene una oportunidad en
 * "En negociación" con solicitudes de Pricing respondidas, permite usar una
 * respuesta y pasar sus datos (ruta, contenedor, agente, naviera, tarifa).
 */
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { OpcionPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
import { usarOpcionPricing } from "@/features/cotizacion/hooks/wizard/usarOpcionPricing";
import { useOpcionesPricingCotizacion } from "@/features/cotizacion/hooks/wizard/useOpcionesPricingCotizacion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Props { form: UseFormReturn<CotizacionFormValues> }

export function OpcionesPricingCotizacion({ form }: Props) {
  const [abierto, setAbierto] = useState(false);
  const oportunidadId = form.watch("oportunidadId") || undefined;
  const clienteId = form.watch("clienteId") || undefined;
  const { data: opciones = [], isError, refetch } = useOpcionesPricingCotizacion({ oportunidadId, clienteId });
  if (isError) return <div role="alert" className="space-y-2 p-4 text-body-sm">
    <p>No se pudieron cargar las respuestas de Pricing.</p>
    <Button size="sm" variant="outline" onClick={() => void refetch()}>Reintentar</Button>
  </div>;
  if (opciones.length === 0) return null;

  const usar = async (o: OpcionPricingCotizacion) => {
    try {
      await usarOpcionPricing(form, o);
      setAbierto(false);
      notifySuccess(undefined, { title: "Datos de Pricing aplicados a la cotización" });
    } catch (error) {
      notifyError(undefined, { title: "No se pudo aplicar la respuesta de Pricing", error, method: "COTIZACION_OPCION_PRICING" });
    }
  };

  return (
    <PageContainer noSpacing className="max-w-6xl pt-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-sm">La empresa está en negociación y tiene {opciones.length} respuesta(s) de Pricing.</p>
            <Button size="sm" variant="outline" onClick={() => setAbierto((v) => !v)}>
              {abierto ? "Ocultar" : "Usar respuesta de Pricing"}
            </Button>
          </div>
          {abierto && opciones.map((o) => (
            <div key={`${o.solicitudId}:${o.tarifa.id}`} className="grid gap-2 rounded-md border p-3 text-body-sm md:grid-cols-5">
              <div><span className="text-muted-foreground">Solicitud: </span>{o.solicitudFolio || "—"}</div>
              <div><span className="text-muted-foreground">Puerto de origen: </span>{o.tarifa.puerto_origen_nombre ?? "—"}<br /><span className="text-muted-foreground">Puerto de destino: </span>{o.tarifa.puerto_destino_nombre ?? "—"}</div>
              <div><span className="text-muted-foreground">Agente: </span>{o.tarifa.agente_nombre ?? "—"}<br /><span className="text-muted-foreground">Naviera: </span>{o.tarifa.naviera_nombre ?? "—"}</div>
              <div><span className="text-muted-foreground">Flete base: </span>{formatCurrency(Number(o.tarifa.flete_base ?? 0), o.tarifa.moneda ?? "USD")}
                {o.tarifa.vigente_hasta ? ` · hasta ${formatDate(o.tarifa.vigente_hasta)}` : ""}</div>
              <div><Button size="sm" onClick={() => usar(o)}>Usar en la cotización</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
