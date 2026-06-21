/**
 * Guía colapsable del módulo de Facturación.
 *
 * Actualizada para reflejar el rediseño v13.92+: el módulo ahora SÓLO contiene
 * emisión de CFDI, complementos de pago (REP) y notas de crédito. La cobranza,
 * pagos a proveedores, histórico de proformas y proyección viven en otros módulos.
 */
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Receipt,
  FileCheck2,
  FileMinus2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const PASOS = [
  {
    n: 1,
    icon: FileCheck2,
    label: "Por timbrar",
    hint: "Proformas aprobadas → emitir CFDI",
  },
  {
    n: 2,
    icon: Receipt,
    label: "Emitidas",
    hint: "CFDI vigentes + complemento de pagos (REP)",
  },
  {
    n: 3,
    icon: FileMinus2,
    label: "Notas de crédito",
    hint: "Cancelaciones y devoluciones",
  },
] as const;

const ENLACES_EXTERNOS = [
  { to: "/cartera", label: "Cobranza a clientes" },
  { to: "/cxp/por-pagar", label: "Pagos a proveedores" },
  { to: "/proformas", label: "Histórico de proformas" },
  { to: "/reportes/cierre-mensual", label: "Proyección / cierre mensual" },
] as const;

export function GuiaPrefacturacion() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="guia" className="border rounded-md bg-card px-4">
        <AccordionTrigger className="text-sm font-medium hover:no-underline">
          ¿Cómo funciona este módulo?
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {PASOS.map((paso, idx) => {
              const Icon = paso.icon;
              return (
                <div key={paso.n} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 bg-background min-w-[140px]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {paso.n}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <div className="flex items-center gap-1 text-xs font-semibold">
                        <Icon className="h-3 w-3" />
                        {paso.label}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{paso.hint}</span>
                    </div>
                  </div>
                  {idx < PASOS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Ciclo:</span> el sistema genera proformas al cerrar
              embarques → las apruebas (o consolidas varias en una) → se timbran como CFDI → si el método es
              PPD, emites el complemento de pago (REP) cuando el cliente paga → si hay devolución, generas la
              nota de crédito.
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>
                <span className="font-medium text-destructive">Hueco de Facturación:</span> alerta global con
                embarques cuyo ETD pasó hace más de 5 días y aún no tienen factura emitida al cliente. Indica
                capital propio financiando al cliente — atiéndelos cuanto antes.
              </span>
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Esto ya no vive aquí
            </p>
            <div className="flex flex-wrap gap-2">
              {ENLACES_EXTERNOS.map((e) => (
                <Link
                  key={e.to}
                  to={e.to}
                  className="inline-flex items-center gap-1 text-xs rounded-md border bg-background px-2 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {e.label}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
              ))}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
