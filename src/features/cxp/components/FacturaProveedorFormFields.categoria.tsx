/**
 * v13.510.0 — Sección "Categoría contable" del formulario de captura.
 *
 * Cuando la factura nace de un documento del buzón (originado en un embarque)
 * la categoría se fija en el costo directo de embarque (COGS) y el selector se
 * muestra bloqueado, con un enlace discreto para cambiarla en casos raros.
 */
import { FileText, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormSection, FieldError, RequiredMark } from "./facturaFormPrimitives";
import type { CategoriaPresupuestoLite } from "@/features/cxp/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  categorias: CategoriaPresupuestoLite[];
  error?: string;
  /** Categoría fijada por el origen del documento (modo buzón). */
  bloqueada?: boolean;
  /** Explicación de por qué está fija. */
  motivo?: string;
  onDesbloquear?: () => void;
  /** Aviso cuando la organización no tiene categoría COGS activa. */
  avisoSinCogs?: string;
}

export function CategoriaContableSection({
  value, onChange, categorias, error, bloqueada = false, motivo, onDesbloquear, avisoSinCogs,
}: Props) {
  return (
    <FormSection title="Categoría contable" icon={<FileText className="h-3.5 w-3.5" />}>
      <div className="space-y-1">
        <Label>Categoría contable<RequiredMark /></Label>
        <Select value={value || ""} onValueChange={onChange} disabled={bloqueada}>
          <SelectTrigger aria-required="true">
            <SelectValue placeholder="Selecciona la categoría contable de esta factura" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {bloqueada ? (
          <div className="flex items-start gap-2 rounded-md border border-info/40 bg-info/5 px-2.5 py-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
            <p className="text-label text-muted-foreground">
              {motivo}
              {onDesbloquear && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-1 text-label"
                  onClick={onDesbloquear}
                >
                  Cambiar categoría
                </Button>
              )}
            </p>
          </div>
        ) : (
          <p className="text-label text-muted-foreground">
            Un mismo proveedor puede emitir facturas para distintas categorías (COGS, gastos
            operativos, OpEx). Si la cambias, esta factura deja de contar como costo del embarque.
          </p>
        )}

        {avisoSinCogs && (
          <p className="text-label text-warning">{avisoSinCogs}</p>
        )}

        <FieldError msg={error} />
      </div>
    </FormSection>
  );
}
