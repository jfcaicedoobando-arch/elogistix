/**
 * Guía colapsable del módulo de Facturación.
 * Explica el flujo de 5 pasos y el Hueco de Facturación.
 */
import { ChevronRight, CheckCircle2, FileText, Receipt, Wallet, AlertTriangle } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const PASOS = [
  { n: 1, icon: CheckCircle2, label: "Por aprobar", hint: "Consolidar y aprobar" },
  { n: 2, icon: FileText, label: "Proformas", hint: "Histórico" },
  { n: 3, icon: Receipt, label: "Facturas", hint: "Emitidas" },
  { n: 4, icon: Wallet, label: "Pagos prov.", hint: "Cuentas por pagar" },
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
                  <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 bg-background min-w-[120px]">
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
              embarques → tú las revisas, consolidas y apruebas → se emiten como facturas → das seguimiento al
              cobro al cliente → y registras los pagos a tus proveedores (navieras, agentes, etc.).
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
