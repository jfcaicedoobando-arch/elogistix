import { Receipt, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks";
import type { useTabProformasController } from "@/features/facturacion/hooks";
import { avisoFusionSeleccion, puedeFusionarSeleccion } from "@/features/facturacion/domain/avisoFusionProformas";

type FusionSelection = Pick<ReturnType<typeof useTabProformasController>,
  "selectedProformas" | "fusionInfo" | "clearSelected">;

/** Validación, contexto y acción de conversión de la selección actual. */
export function ProformasFusionToolbar({ selection }: { selection: FusionSelection }) {
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();
  const { selectedProformas, fusionInfo, clearSelected } = selection;
  const seleccionados = selectedProformas.length;
  const avisoFusion = avisoFusionSeleccion(fusionInfo);
  const puedeFusionar = puedeFusionarSeleccion(seleccionados, fusionInfo);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="text-body flex-1 min-w-[240px]">
          <strong>{seleccionados}</strong> proforma{seleccionados === 1 ? "" : "s"} seleccionada{seleccionados === 1 ? "" : "s"}
          {fusionInfo.clienteNombre && <> · {fusionInfo.clienteNombre}</>}
        </div>
        {avisoFusion && (
          <Alert variant="destructive" className="py-2 px-3 m-0 w-full md:w-auto">
            <AlertDescription className="text-body-sm">{avisoFusion}</AlertDescription>
          </Alert>
        )}
        <Button variant="ghost" size="sm" onClick={clearSelected}>
          <X className="h-4 w-4 mr-1" /> Limpiar
        </Button>
        <Button
          size="sm"
          disabled={!puedeFusionar || convirtiendo}
          loading={convirtiendo}
          onClick={() => {
            if (!fusionInfo.organizationId) return;
            convertir(
              {
                proformaIds: selectedProformas.map((p) => p.id),
                organizationId: fusionInfo.organizationId,
                diasCredito: fusionInfo.diasCredito,
              },
              { onSuccess: clearSelected },
            );
          }}
        >
          {!convirtiendo && <Receipt className="h-4 w-4 mr-1" />}
          {seleccionados === 1 ? "Convertir a factura" : `Fusionar ${seleccionados} en una factura`}
        </Button>
      </CardContent>
    </Card>
  );
}
