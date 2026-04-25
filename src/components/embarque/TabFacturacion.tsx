import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useEmbarqueConceptosVenta } from "@/hooks/useEmbarques";
import { useProformasEmbarque, useEliminarProforma } from "@/hooks/embarque/useProformas";
import { useDescargarProformaPdf } from "@/hooks/embarque/useDescargarProformaPdf";
import { DialogGenerarProforma } from "./DialogGenerarProforma";
import { ResumenConceptosVenta } from "./facturacion/ResumenConceptosVenta";
import { HistorialProformas } from "./facturacion/HistorialProformas";
import { HistorialFacturas } from "./facturacion/HistorialFacturas";
import type { Tables } from "@/integrations/supabase/types";

type EmbarqueRow = Tables<'embarques'>;

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  estado: string;
  proforma_id?: string | null;
  factura_pdf_url?: string | null;
  factura_xml_url?: string | null;
}

interface Props {
  facturas: Factura[];
  canEdit: boolean;
  embarque: EmbarqueRow;
}

export function TabFacturacion({ facturas, canEdit, embarque }: Props) {
  const tasaIva = useTasaIVA();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: conceptos = [] } = useEmbarqueConceptosVenta(embarque.id);
  const { data: proformas = [] } = useProformasEmbarque(embarque.id);
  const eliminarProforma = useEliminarProforma();
  const { descargar: descargarProformaPdf } = useDescargarProformaPdf();
  const [proformaAEliminar, setProformaAEliminar] = useState<{ id: string; numero: string } | null>(null);

  const conceptosPendientes = useMemo(
    () => conceptos.filter(c => c.estado_facturacion !== 'en_proforma'),
    [conceptos]
  );

  const handleDescargarProforma = async (proformaId: string) => {
    const proforma = proformas.find(p => p.id === proformaId);
    if (!proforma) return;
    await descargarProformaPdf(proforma, { embarqueOverride: embarque });
  };

  return (
    <div className="space-y-4">
      <ResumenConceptosVenta
        conceptos={conceptos}
        tasaIva={tasaIva}
        canEdit={canEdit}
        onGenerarProforma={() => setDialogOpen(true)}
      />

      <HistorialProformas
        proformas={proformas}
        canEdit={canEdit}
        isDeleting={eliminarProforma.isPending}
        onDescargar={handleDescargarProforma}
        onEliminar={(id, numero) => setProformaAEliminar({ id, numero })}
      />

      <HistorialFacturas facturas={facturas} proformas={proformas} />

      <DialogGenerarProforma
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        embarque={embarque}
        conceptosPendientes={conceptosPendientes}
      />

      <AlertDialog open={!!proformaAEliminar} onOpenChange={(o) => !o && setProformaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proforma</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la proforma <strong>{proformaAEliminar?.numero}</strong>? Los conceptos volverán a estado Pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminarProforma.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminarProforma.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (!proformaAEliminar) return;
                try {
                  await eliminarProforma.mutateAsync({
                    proformaId: proformaAEliminar.id,
                    embarqueId: embarque.id,
                    numero: proformaAEliminar.numero,
                  });
                  setProformaAEliminar(null);
                } catch {
                  // Error manejado en hook
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminarProforma.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <>Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
