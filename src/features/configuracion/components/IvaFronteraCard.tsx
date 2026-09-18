/**
 * Card "IVA 8% región fronteriza" (P2-IVA).
 *
 * El SAT trata el 8% como un ESTÍMULO FISCAL sujeto a aviso y requisitos, no
 * como una tasa general. Por eso viene deshabilitado y sólo Contabilidad lo
 * activa aquí, después de confirmar la elegibilidad. Los conceptos ya guardados
 * al 8% NO se modifican: este ajuste sólo gobierna nuevas selecciones.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useUpdateConfiguracion } from "@/features/configuracion/hooks/useConfiguracion";
import { useIvaFronteraHabilitada } from "@/features/configuracion/hooks/useIvaFrontera";
import {
  AVISO_IVA_FRONTERA_TEXTO,
  CONFIG_IVA_FRONTERA,
  URL_SAT_IVA_FRONTERA,
} from "@/lib/financial/ivaFrontera";

export default function IvaFronteraCard() {
  const habilitada = useIvaFronteraHabilitada();
  const updateConfig = useUpdateConfiguracion();

  const cambiar = (valor: boolean) => {
    updateConfig.mutate([
      { categoria: CONFIG_IVA_FRONTERA.categoria, clave: CONFIG_IVA_FRONTERA.clave, valor },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>IVA 8% — región fronteriza</CardTitle>
        <CardDescription>
          Permite elegir la tasa de 8% en conceptos nuevos. Los conceptos ya guardados al
          8% se conservan sin cambios, aunque este ajuste esté apagado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            {AVISO_IVA_FRONTERA_TEXTO}{" "}
            <a
              href={URL_SAT_IVA_FRONTERA}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Información oficial del SAT
            </a>
            .
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-3">
          <Switch
            checked={habilitada}
            onCheckedChange={cambiar}
            disabled={updateConfig.isPending}
            aria-label="Habilitar la tasa de IVA 8% de región fronteriza"
          />
          <span className="text-body-sm">
            {habilitada
              ? "Habilitada: Contabilidad confirmó la elegibilidad."
              : "Deshabilitada (recomendado si no eres contribuyente de la región fronteriza)."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
