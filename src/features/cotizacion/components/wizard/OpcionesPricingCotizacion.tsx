/**
 * Paso 1 de una cotización nueva: si la empresa tiene una oportunidad en
 * "En negociación" con solicitudes de Pricing respondidas, permite usar una
 * respuesta y pasar sus datos (ruta, contenedor, agente, naviera, tarifa).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import { fetchOpcionesPricingCotizacion, type OpcionPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
import { aplicarTarifaAlForm } from "@/features/cotizacion/components/seccionRuta/aplicarTarifa";
import { notifySuccess } from "@/lib/ui/appFeedback";

interface Props { form: UseFormReturn<CotizacionFormValues> }

export function OpcionesPricingCotizacion({ form }: Props) {
  const [abierto, setAbierto] = useState(false);
  const oportunidadId = form.watch("oportunidadId") || undefined;
  const clienteId = form.watch("clienteId") || undefined;
  const { data: opciones = [] } = useQuery({
    queryKey: ["cotizacion", "opciones-pricing", oportunidadId ?? null, clienteId ?? null],
    queryFn: () => fetchOpcionesPricingCotizacion({ oportunidadId, clienteId }),
    enabled: Boolean(oportunidadId || clienteId),
  });
  if (opciones.length === 0) return null;

  const usar = (o: OpcionPricingCotizacion) => {
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    if (!form.getValues("oportunidadId") && o.oportunidadId) form.setValue("oportunidadId", o.oportunidadId, opts);
    form.setValue("modo", "Marítimo", opts);
    aplicarTarifaAlForm(form.setValue, form.trigger, o.tarifa);
    setAbierto(false);
    notifySuccess(undefined, { title: "Datos de Pricing aplicados a la cotización" });
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
            <div key={String(o.tarifa.id)} className="grid gap-2 rounded-md border p-3 text-body-sm md:grid-cols-5">
              <div><span className="text-muted-foreground">Solicitud: </span>{o.solicitudFolio || "—"}</div>
              <div><span className="text-muted-foreground">Puertos: </span>{o.tarifa.puerto_origen_nombre ?? "—"} → {o.tarifa.puerto_destino_nombre ?? "—"}</div>
              <div><span className="text-muted-foreground">Agente / Naviera: </span>{o.tarifa.agente_nombre ?? "—"} / {o.tarifa.naviera_nombre ?? "—"}</div>
              <div><span className="text-muted-foreground">Flete: </span>{formatCurrency(Number(o.tarifa.flete_base ?? 0), o.tarifa.moneda ?? "USD")}
                {o.tarifa.vigente_hasta ? ` · hasta ${formatDate(o.tarifa.vigente_hasta)}` : ""}</div>
              <div><Button size="sm" onClick={() => usar(o)}>Usar en la cotización</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
