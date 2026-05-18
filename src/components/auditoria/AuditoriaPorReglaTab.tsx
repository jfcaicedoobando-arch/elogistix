import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { HallazgoTabla } from "@/components/auditoria/HallazgoTabla";
import { REGLA_INFO, REGLAS_ORDEN } from "@/lib/ui/auditoriaConfig";
import type { useAuditoriaPageController } from "@/hooks/auditoria";

interface Props {
  c: ReturnType<typeof useAuditoriaPageController>;
}

export function AuditoriaPorReglaTab({ c }: Props) {
  if (c.isLoading) return <Skeleton className="h-64" />;
  return (
    <Accordion type="multiple" defaultValue={REGLAS_ORDEN} className="space-y-2">
      {REGLAS_ORDEN.map((regla) => {
        const cfg = REGLA_INFO[regla];
        const items = c.porRegla[regla];
        const Icon = cfg.icon;
        return (
          <AccordionItem key={regla} value={regla} className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 flex-1 text-left">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{cfg.label}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {cfg.description}
                  </div>
                </div>
                <Badge variant={items.length > 0 ? "destructive" : "secondary"}>
                  {items.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <HallazgoTabla hallazgos={items} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
