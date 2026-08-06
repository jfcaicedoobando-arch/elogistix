/**
 * FacturaConceptosEditor — editor CRUD de renglones de un borrador.
 * Sólo visible cuando la factura está en estado `Borrador` y el usuario
 * tiene permiso de edición. Escribe en `conceptos_factura` y dispara el
 * recálculo de subtotal/IVA/total en la factura padre.
 */
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFacturaConceptosEditorController } from "@/features/facturacion/hooks/useFacturaConceptosEditorController";
import { ConceptoRow, NuevoRow } from "./FacturaConceptosEditorRows";
import type { ConceptoFacturaRow } from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  facturaId: string;
  organizationId: string;
  moneda: Moneda;
  conceptos: ConceptoFacturaRow[];
}

export function FacturaConceptosEditor({ facturaId, organizationId, moneda, conceptos }: Props) {
  const {
    editingId,
    draft,
    setDraft,
    showNew,
    setShowNew,
    startEdit,
    setEditingId,
    busy,
    addMut,
    updateMut,
    deleteMut,
    EMPTY,
  } = useFacturaConceptosEditorController({ facturaId, organizationId, moneda });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Editar conceptos del borrador</CardTitle>
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => { setShowNew(true); setDraft(EMPTY); }}
          disabled={showNew || busy}
        >
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {conceptos.length === 0 && !showNew && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Este borrador aún no tiene conceptos. Agrega al menos uno antes de timbrar.
          </p>
        )}

        {conceptos.map((row) => (
          <ConceptoRow
            key={row.id} row={row} moneda={moneda}
            isEditing={editingId === row.id}
            draft={draft} setDraft={setDraft}
            onStartEdit={() => startEdit(row)}
            onCancelEdit={() => setEditingId(null)}
            onSave={() => updateMut.mutate({ conceptoId: row.id, input: draft })}
            onDelete={() => deleteMut.mutate(row.id)}
            busy={busy}
          />
        ))}

        {showNew && (
          <NuevoRow
            draft={draft} setDraft={setDraft}
            onCancel={() => { setShowNew(false); setDraft(EMPTY); }}
            onSave={() => addMut.mutate(draft)}
            busy={busy}
          />
        )}
      </CardContent>
    </Card>
  );
}
