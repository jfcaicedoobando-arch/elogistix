/**
 * Placeholder Fase 2 — Matriz de tarifas. La UI completa (alta, filtros, recargos
 * embebidos, badges de estado) llega en la siguiente iteración del módulo Costeo.
 */
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function CosteoTarifas() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Tarifas marítimas</h1>
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <Construction className="size-10 text-muted-foreground" />
        <p className="text-foreground font-medium">Matriz de tarifas (Fase 2)</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Aquí vivirá la captura de tarifas por agente, naviera, ruta y tipo de contenedor con sus recargos
          y vigencia. Ya están listos los catálogos de Agentes y Rutas.
        </p>
      </Card>
    </div>
  );
}
