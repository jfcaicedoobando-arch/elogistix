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
import { useProformasListasCount } from "@/features/facturacion/hooks/useProformasListas";

export type BandejaId =
  | "embarques-sin-factura" | "proformas-listas"
  | "por-timbrar" | "por-enviar"
  | "por-cobrar" | "vencidas" | "rep-pendientes"
  | "emitidas" | "notas";

type GroupId = "preparar" | "cobrar" | "historico";

interface Def {
  id: BandejaId;
  label: string;
  hint?: string;
  tone: "default" | "warn" | "danger";
  group: GroupId;
}

const GROUP_LABELS: Record<GroupId, string> = {
  preparar: "Preparar",
  cobrar: "Cobrar",
  historico: "Histórico",
};

// Sólo mantenemos tooltip en los tabs con criterio técnico no evidente.
// El resto usa un label auto-descriptivo (ley de Miller: menos ruido cognitivo).
const DEFS: Def[] = [
  { id: "embarques-sin-factura", label: "Embarques sin factura", hint: "Embarques cuyo contenedor ya llegó (ETA ≤ hoy) y aún no tienen CFDI. Necesitan factura para tener la papelería completa al cruzar aduana. Puede que falte generar la proforma o convertirla a factura.", tone: "warn", group: "preparar" },
  { id: "proformas-listas", label: "Proformas listas", tone: "warn", group: "preparar" },
  { id: "por-timbrar", label: "Por timbrar", hint: "Facturas en Borrador creadas en el sistema, pendientes de enviar a FacturApi (timbrado CFDI).", tone: "warn", group: "preparar" },
  { id: "por-enviar", label: "Por enviar", tone: "warn", group: "preparar" },
  { id: "por-cobrar", label: "Por cobrar", tone: "default", group: "cobrar" },
  { id: "vencidas", label: "Vencidas", tone: "danger", group: "cobrar" },
  { id: "rep-pendientes", label: "REP pendientes", hint: "Complementos de Pago (REP) para facturas PPD que faltan por timbrar.", tone: "danger", group: "cobrar" },
  { id: "emitidas", label: "Emitidas", tone: "default", group: "historico" },
  { id: "notas", label: "Notas de crédito", tone: "default", group: "historico" },
];

function badgeClass(tone: Def["tone"]): string {
  if (tone === "danger") return "bg-destructive/15 text-destructive";
  if (tone === "warn") return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

type BadgeConteosMap = Record<Exclude<BandejaId, "emitidas" | "notas">, number>;

export function BandejaTabs() {
  const { data: conteos } = useBandejaConteos();
  const { totalEmbarques } = useHuecoFacturacion();
  const { data: proformasListasCount = 0 } = useProformasListasCount();

  const counts: BadgeConteosMap = {
    "embarques-sin-factura": totalEmbarques,
    "proformas-listas": proformasListasCount,
    "por-timbrar": conteos?.porTimbrar ?? 0,
    "por-enviar": conteos?.porEnviar ?? 0,
    "por-cobrar": conteos?.porCobrar ?? 0,
    "vencidas": conteos?.vencidas ?? 0,
    "rep-pendientes": conteos?.repPendientes ?? 0,
  };

  const groups: GroupId[] = ["preparar", "cobrar", "historico"];

  return (
    // v13.823.25 (fold 692px): en móvil cada grupo ocupa su propio renglón para
    // que los rótulos ("Preparar", "Cobrar", "Histórico") no queden sueltos.
    <TabsList variant="underline" className="border-b-0 h-auto flex flex-col items-stretch gap-1 md:flex-row md:flex-wrap md:items-stretch md:gap-0">
      {groups.map((group, gIdx) => {
        const defs = DEFS.filter((d) => d.group === group);
        return (
          <div key={group} className="flex items-stretch">
            {gIdx > 0 && (
              <span aria-hidden className="mx-2 hidden self-center h-6 w-px bg-border md:block" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">

              <span className="px-3 pt-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {GROUP_LABELS[group]}
              </span>
              <div className="flex flex-wrap gap-1">
                {defs.map((d) => {
                  const count = d.id === "emitidas" || d.id === "notas" ? 0 : counts[d.id];
                  return (
                    <TabsTrigger
                      key={d.id}
                      value={d.id}
                      variant="underline"
                      className="px-3 py-2 data-[state=active]:text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        {d.label}
                        {typeof count === "number" && count > 0 && (
                          <span className={`text-2xs font-semibold rounded-full px-1.5 py-0.5 tabular-nums ${badgeClass(d.tone)}`}>
                            {count}
                          </span>
                        )}
                        {d.hint && (
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
                            <TooltipContent
                              side="bottom"
                              collisionPadding={12}
                              className="max-w-sm text-body-sm leading-relaxed whitespace-normal"
                            >
                              {d.hint}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </TabsList>
  );
}
