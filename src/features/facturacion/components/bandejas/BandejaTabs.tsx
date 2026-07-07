/**
 * Fila de tabs del cockpit de Facturación (Fase 2).
 * Cada tab expone un badge con el conteo — sólo se muestra si > 0.
 * Los tonos ("warn", "danger") comunican urgencia sin ruido.
 */
import { Info } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { useBandejaConteos } from "@/features/facturacion/hooks/useBandejas";

export type BandejaId =
  | "por-facturar" | "por-timbrar" | "por-enviar"
  | "por-cobrar" | "vencidas" | "rep-pendientes"
  | "emitidas" | "notas";

interface Def {
  id: BandejaId;
  label: string;
  hint: string;
  tone: "default" | "warn" | "danger";
}

const DEFS: Def[] = [
  { id: "por-facturar", label: "Por facturar", hint: "Embarques cerrados sin CFDI (hueco de facturación).", tone: "warn" },
  { id: "por-timbrar", label: "Por timbrar", hint: "Borradores creados en el sistema pendientes de enviar a FacturApi.", tone: "warn" },
  { id: "por-enviar", label: "Por enviar", hint: "CFDI ya timbrados que no se han mandado por correo al cliente.", tone: "warn" },
  { id: "por-cobrar", label: "Por cobrar", hint: "Facturas vigentes con saldo pendiente, aún no vencidas.", tone: "default" },
  { id: "vencidas", label: "Vencidas", hint: "Facturas con vencimiento pasado y saldo > 0.", tone: "danger" },
  { id: "rep-pendientes", label: "REP pendientes", hint: "Complementos de Pago (REP) para facturas PPD que faltan por timbrar.", tone: "danger" },
  { id: "emitidas", label: "Emitidas", hint: "Historial completo de facturas emitidas.", tone: "default" },
  { id: "notas", label: "Notas de crédito", hint: "Historial de notas de crédito.", tone: "default" },
];

function badgeClass(tone: Def["tone"]): string {
  if (tone === "danger") return "bg-destructive/15 text-destructive";
  if (tone === "warn") return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

interface BadgeConteosMap {
  "por-facturar": number;
  "por-timbrar": number;
  "por-enviar": number;
  "por-cobrar": number;
  "vencidas": number;
  "rep-pendientes": number;
}

export function BandejaTabs() {
  const { data: conteos } = useBandejaConteos();
  const { totalEmbarques } = useHuecoFacturacion();

  const counts: BadgeConteosMap = {
    "por-facturar": totalEmbarques,
    "por-timbrar": conteos?.porTimbrar ?? 0,
    "por-enviar": conteos?.porEnviar ?? 0,
    "por-cobrar": conteos?.porCobrar ?? 0,
    "vencidas": conteos?.vencidas ?? 0,
    "rep-pendientes": conteos?.repPendientes ?? 0,
  };

  return (
    <TabsList className="bg-transparent border-0 p-0 h-auto flex flex-wrap gap-1">
      {DEFS.map((d) => {
        const count = (counts as Record<string, number | undefined>)[d.id];
        return (
          <TabsTrigger
            key={d.id}
            value={d.id}
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none -mb-px"
          >
            <span className="flex items-center gap-1.5">
              {d.label}
              {typeof count === "number" && count > 0 && (
                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums ${badgeClass(d.tone)}`}>
                  {count}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Info: ${d.label}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="inline-flex"
                  >
                    <Info className="h-3 w-3 opacity-60 hover:opacity-100" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-xs">{d.hint}</TooltipContent>
              </Tooltip>
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
