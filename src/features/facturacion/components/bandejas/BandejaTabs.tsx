/**
 * Fila de tabs del cockpit de Facturación (Fase 2).
 * Cada tab expone un badge con el conteo — sólo se muestra si > 0.
 * Los tonos ("warn", "danger") comunican urgencia sin ruido.
 */
import { Info } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { useBandejaConteos } from "@/features/facturacion/hooks/useBandejas";
import { useProformasListasCount } from "@/features/facturacion/hooks/useProformasListas";

export type BandejaId =
  | "embarques-sin-factura" | "proformas-listas"
  | "por-timbrar"
  | "por-cobrar" | "vencidas" | "rep-pendientes"
  | "emitidas" | "notas" | "reps";

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

const GROUP_FIRST: Record<GroupId, BandejaId> = {
  preparar: "embarques-sin-factura",
  cobrar: "por-cobrar",
  historico: "emitidas",
};

// Sólo mantenemos tooltip en los tabs con criterio técnico no evidente.
// El resto usa un label auto-descriptivo (ley de Miller: menos ruido cognitivo).
const DEFS: Def[] = [
  { id: "embarques-sin-factura", label: "Embarques sin factura", hint: "Embarques cuyo contenedor ya llegó (ETA ≤ hoy) y aún no tienen CFDI. Necesitan factura para tener la papelería completa al cruzar aduana. Puede que falte generar la proforma o convertirla a factura.", tone: "warn", group: "preparar" },
  { id: "proformas-listas", label: "Proformas listas", tone: "warn", group: "preparar" },
  { id: "por-timbrar", label: "Por timbrar", hint: "Facturas en Borrador creadas en el sistema, pendientes de enviar a FacturApi (timbrado CFDI).", tone: "warn", group: "preparar" },
  
  { id: "por-cobrar", label: "Por cobrar", tone: "default", group: "cobrar" },
  { id: "vencidas", label: "Vencidas", tone: "danger", group: "cobrar" },
  { id: "rep-pendientes", label: "REP pendientes", hint: "Complementos de Pago (REP) para facturas PPD que faltan por timbrar.", tone: "danger", group: "cobrar" },
  { id: "emitidas", label: "Emitidas", tone: "default", group: "historico" },
  { id: "notas", label: "Notas de crédito", tone: "default", group: "historico" },
  { id: "reps", label: "REPs", hint: "Complementos de Pago (REP) ya timbrados ante el SAT. Consulta y descarga de PDF/XML; los pendientes por timbrar están en Cobrar → REP pendientes.", tone: "default", group: "historico" },
];

function badgeClass(tone: Def["tone"]): string {
  if (tone === "danger") return "bg-destructive/15 text-destructive";
  if (tone === "warn") return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

type BadgeConteosMap = Record<Exclude<BandejaId, "emitidas" | "notas" | "reps">, number>;

export function BandejaTabs({ activeBandeja, onSelect }: {
  activeBandeja: BandejaId;
  onSelect: (id: BandejaId) => void;
}) {
  const { data: conteos } = useBandejaConteos();
  const { totalEmbarques } = useHuecoFacturacion();
  const { data: proformasListasCount = 0 } = useProformasListasCount();

  const counts: BadgeConteosMap = {
    "embarques-sin-factura": totalEmbarques,
    "proformas-listas": proformasListasCount,
    "por-timbrar": conteos?.porTimbrar ?? 0,
    
    "por-cobrar": conteos?.porCobrar ?? 0,
    "vencidas": conteos?.vencidas ?? 0,
    "rep-pendientes": conteos?.repPendientes ?? 0,
  };

  const groups: GroupId[] = ["preparar", "cobrar", "historico"];

  const activeGroup = DEFS.find((d) => d.id === activeBandeja)?.group ?? "preparar";
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap gap-1 px-1 pt-1" aria-label="Etapa de facturación">
        {groups.map((group) => (
          <Button
            key={group}
            type="button"
            variant={activeGroup === group ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={activeGroup === group}
            onClick={() => onSelect(GROUP_FIRST[group])}
          >
            {GROUP_LABELS[group]}
          </Button>
        ))}
      </div>
      <TabsList variant="underline" aria-label={`Bandejas de ${GROUP_LABELS[activeGroup]}`} className="flex h-auto flex-wrap items-stretch gap-2 border-b-0 px-1">
        {DEFS.filter((d) => d.group === activeGroup).map((d) => {
          const count = d.id === "emitidas" || d.id === "notas" || d.id === "reps" ? 0 : counts[d.id];
          return (
            <TabsTrigger
              key={d.id}
              value={d.id}
              variant="underline"
              className="px-2 py-1.5 data-[state=active]:text-primary"
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
      </TabsList>
    </div>
  );
}
