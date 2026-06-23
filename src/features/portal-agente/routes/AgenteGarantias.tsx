/**
 * Carta garantía y tabulador de demoras del agente.
 * v1: muestra el estado actual; la edición vendrá en iteración posterior.
 */
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShieldCheck, Info } from "lucide-react";

export default function AgenteGarantias() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Carta garantía y demoras"
        description="Mantén actualizado el PDF de tu carta garantía y el tabulador escalonado de demoras por naviera."
      />

      <Card className="p-6 text-center space-y-3">
        <ShieldCheck className="h-10 w-10 mx-auto text-accent" />
        <p className="text-sm font-medium">Próximamente</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          La captura desde el portal estará disponible en la próxima iteración.
          Por ahora envía tu carta garantía y tu tabulador de demoras a tu contacto de operaciones
          para que la cargue por ti.
        </p>
      </Card>

      <Card className="p-3 flex items-start gap-2 bg-muted/40">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>¿Por qué importa?</strong> La carta garantía vigente permite que tus tarifas
          aparezcan como prioritarias en el comparador de cotizaciones. Si vence, el sistema
          marca tus tarifas con un aviso amarillo.
        </p>
      </Card>
    </div>
  );
}
