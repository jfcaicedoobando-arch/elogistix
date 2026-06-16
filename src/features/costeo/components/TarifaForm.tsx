/**
 * Formulario de alta/edición de tarifa marítima con sub-editor de recargos.
 * Todas las tarifas se capturan en USD (Fase 3).
 * Sub-componentes en `TarifaFormFields.tsx`, helpers en `TarifaForm.helpers.ts`.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import { useNavieras, useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaRecargosEditor } from "./TarifaRecargosEditor";
import {
  EntidadesFields, RutaTipoFields, NumerosFields, VigenciaFields,
} from "./TarifaFormFields";
import {
  buildInitialForm, calcularTotal, esFormValido, usdFormatter,
} from "./TarifaForm.helpers";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TarifaInput>;
  tarifaId?: string;
}

export function TarifaForm({ open, onOpenChange, initial, tarifaId }: Props) {
  const { data: agentes = [] } = useCosteoAgentes();
  const { data: rutas = [] } = useCosteoRutas();
  const { data: navieras = [] } = useNavieras();
  const { data: tipos = [] } = useTiposContenedor();
  const { crear, actualizar } = useCosteoTarifaMutations();

  const [form, setForm] = useState<TarifaInput>(() => buildInitialForm(initial));

  useEffect(() => {
    if (open) setForm(buildInitialForm(initial));
  }, [open, initial]);

  const total = useMemo(() => calcularTotal(form), [form]);
  const valido = esFormValido(form);
  const esEdicion = Boolean(tarifaId);
  const pendiente = crear.isPending || actualizar.isPending;

  const guardar = () => {
    if (!valido) return;
    if (esEdicion && tarifaId) {
      actualizar.mutate(
        { id: tarifaId, input: form },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      crear.mutate(form, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl", scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar tarifa marítima (USD)" : "Nueva tarifa marítima (USD)"}
          </DialogTitle>
          <DialogDescription>Captura o edita la tarifa marítima con sus costos y condiciones.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <EntidadesFields form={form} setForm={setForm} agentes={agentes} navieras={navieras} />
          <RutaTipoFields form={form} setForm={setForm} rutas={rutas} tipos={tipos} />
          <NumerosFields form={form} setForm={setForm} />
          <VigenciaFields form={form} setForm={setForm} />

          <TarifaRecargosEditor
            value={form.recargos}
            onChange={(recargos: TarifaRecargoInput[]) => setForm({ ...form, recargos })}
          />

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas ?? ""}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Condiciones, restricciones, comentarios del agente…" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border">
            <span className="text-sm text-muted-foreground">Total comparable (flete + recargos)</span>
            <span className="text-lg font-semibold text-foreground">{usdFormatter(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || pendiente}>
            {pendiente ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar tarifa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
