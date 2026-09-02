/**
 * Diálogo de condiciones de naviera: carta garantía, días libres y tabulador
 * de demoras. Compartido por `CosteoNavieras` y `AgenteGarantias`.
 */
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature } from "lucide-react";
import { NavieraCondicionForm } from "@/features/costeo/components/NavieraCondicionForm";
import { DemorasTarifaEditor } from "@/features/costeo/components/DemorasTarifaEditor";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

interface NavieraCondicionesDialogProps {
  seleccion: FilaNaviera | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function NavieraCondicionesDialog({
  seleccion,
  onOpenChange,
  onSaved,
}: NavieraCondicionesDialogProps) {
  return (
    <FormDialogShell
      open={!!seleccion}
      onOpenChange={onOpenChange}
      icon={FileSignature}
      title={seleccion ? `Condiciones — ${seleccion.naviera_nombre}` : "Condiciones"}
      description="Carta garantía, días libres y tabulador de demoras por tipo de contenedor."
      size="3xl"
      footer={null}
    >
      {seleccion && (
        <Tabs defaultValue="condiciones">
          <TabsList>
            <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
            <TabsTrigger
              value="demoras"
              disabled={!seleccion.condicion}
              title={
                !seleccion.condicion
                  ? "Primero guarda las condiciones generales para habilitar el tabulador"
                  : undefined
              }
            >
              Tabulador de demoras
            </TabsTrigger>
          </TabsList>
          <TabsContent value="condiciones" className="pt-4">
            <NavieraCondicionForm
              navieraId={seleccion.naviera_id}
              navieraNombre={seleccion.naviera_nombre}
              existente={seleccion.condicion}
              onSaved={onSaved}
            />
          </TabsContent>
          <TabsContent value="demoras" className="pt-4">
            {seleccion.condicion ? (
              <DemorasTarifaEditor navieraCondicionId={seleccion.condicion.id} />
            ) : (
              <p className="text-body text-muted-foreground">
                Primero guarda las condiciones generales para habilitar el tabulador.
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </FormDialogShell>
  );
}
