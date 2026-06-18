/**
 * Página: Rutas de costeo (par puerto origen CN → destino MX).
 * v13.56.4: diálogo extraído a `components/RutaFormDialog.tsx` (auditoría — paso 14).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useCosteoRutas, useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { RutaFormDialog } from "@/features/costeo/components/RutaFormDialog";

export default function CosteoRutas() {
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { crear, eliminar } = useCosteoRutaMutations();
  const [open, setOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Rutas marítimas"
        description="Pares puerto China → puerto México disponibles para tarificar."
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />Nueva ruta</Button>}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origen (CN)</TableHead>
              <TableHead>Destino (MX)</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rutas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin rutas registradas.
                </TableCell>
              </TableRow>
            )}
            {rutas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.puerto_origen_nombre ?? "—"}</TableCell>
                <TableCell>{r.puerto_destino_nombre ?? "—"}</TableCell>
                <TableCell>{r.activa ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setAEliminar(r.id)}
                    aria-label="Eliminar ruta"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RutaFormDialog open={open} onOpenChange={setOpen} crear={crear} rutas={rutas} />

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title="¿Eliminar esta ruta?"
        description="Esta acción no se puede deshacer."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
