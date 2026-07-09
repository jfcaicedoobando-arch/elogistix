/**
 * Una fila editable para un contenedor dentro de ListaContenedoresEditable.
 * v13.232.0 · Confirmación migrada a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { NumericInput } from "@/components/shared/NumericInput";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import type { TipoContenedor } from "@/features/catalogos/hooks";

interface Props {
  index: number;
  value: ContenedorBorrador;
  tiposContenedor: TipoContenedor[];
  canDelete: boolean;
  onChange: (cambios: Partial<ContenedorBorrador>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function FilaContenedor({
  index,
  value,
  tiposContenedor,
  canDelete,
  onChange,
  onDelete,
  disabled,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const uid = useId();
  const filaVacia =
    !value.numero_contenedor.trim() && !value.tipo_contenedor.trim();

  const handleTrashClick = () => {
    if (filaVacia) {
      onDelete();
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Contenedor #{index + 1}
        </span>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleTrashClick}
            aria-label={`Eliminar contenedor ${index + 1}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`¿Eliminar contenedor #${index + 1}?`}
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          onDelete();
          setConfirmOpen(false);
        }}
        description={
          <>
            Se quitará el contenedor «{value.numero_contenedor || "sin número"}»
            {value.tipo_contenedor ? ` (${value.tipo_contenedor})` : ""} de la lista.
            El cambio se aplica al presionar <strong>Guardar cambios</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-num`} className="text-xs">Número *</Label>
          <Input
            id={`${uid}-num`}
            placeholder="MSCU1234567"
            value={value.numero_contenedor}
            onChange={(e) => onChange({ numero_contenedor: e.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${uid}-tipo`} className="text-xs">Tipo *</Label>
          <Select
            value={value.tipo_contenedor || undefined}
            onValueChange={(v) => onChange({ tipo_contenedor: v })}
            disabled={disabled}
          >
            <SelectTrigger id={`${uid}-tipo`}>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {tiposContenedor
                .filter((ct) => ct.code !== "LCL")
                .map((ct) => (
                  <SelectItem key={ct.code} value={ct.code}>
                    {ct.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`${uid}-blhouse`} className="text-xs">BL House (opcional)</Label>
          <Input
            id={`${uid}-blhouse`}
            placeholder="Número BL House"
            value={value.bl_house}
            onChange={(e) => onChange({ bl_house: e.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Peso (kg)</Label>
          <NumericInput
            value={value.peso_kg}
            onChange={(n: number) => onChange({ peso_kg: n })}
            decimals
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Volumen (m³)</Label>
          <NumericInput
            value={value.volumen_m3}
            onChange={(n: number) => onChange({ volumen_m3: n })}
            decimals
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Piezas</Label>
          <NumericInput
            value={value.piezas}
            onChange={(n: number) => onChange({ piezas: n })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
