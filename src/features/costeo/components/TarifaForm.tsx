/**
 * Formulario de alta/edición de tarifa marítima con sub-editor de recargos.
 * Todas las tarifas se capturan en USD (Fase 3).
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import { useNavieras, useTiposContenedor } from "@/features/catalogos/hooks";
import { TarifaRecargosEditor } from "./TarifaRecargosEditor";
import {
  EntidadesFields, RutaTipoFields, NumerosFields, VigenciaFields,
} from "./TarifaFormFields";
import {
  buildInitialForm, calcularTotal, esFormValido,
  calcularErrores, camposFaltantes, computeGuardarLabel,
  computeValido, getTituloModal, esTarifaSucia,
} from "./TarifaForm.helpers";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";

import { formatUSD } from "@/lib/formatters";
import { useTarifaSubmit } from "@/features/costeo/hooks/useTarifaSubmit";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TarifaInput>;
  tarifaId?: string;
  /** Si se provee, bloquea el Select de agente y oculta la lógica de selección manual. */
  agenteIdFijo?: string;
  /** Nombre del agente a mostrar como readonly cuando agenteIdFijo está presente. */
  agenteNombreFijo?: string;
  /** Override del título del modal (e.g. cuando es desde el portal del agente). */
  tituloOverride?: string;
  /** Rutas a usar en lugar de useCosteoRutas() (útil cuando no hay OrganizationContext). */
  rutasOverride?: Array<{ id: string; activa: boolean; puerto_origen_nombre?: string; puerto_destino_nombre?: string }>;
}




export function TarifaForm({ open, onOpenChange, initial, tarifaId, agenteIdFijo, agenteNombreFijo, tituloOverride, rutasOverride }: Props) {
  const { data: agentesData = [] } = useCosteoAgentes();
  const { data: rutasData = [] } = useCosteoRutas();
  const { data: navieras = [] } = useNavieras();
  const { data: tipos = [] } = useTiposContenedor();
  const mutations = useCosteoTarifaMutations();
  const { crear, crearMultiples, actualizar } = mutations;
  const agentes = agentesData;
  const rutas = rutasOverride ?? rutasData;

  const [form, setForm] = useState<TarifaInput>(() =>
    buildInitialForm(agenteIdFijo ? { ...initial, agente_id: agenteIdFijo } : initial),
  );
  const [rutaIds, setRutaIds] = useState<string[]>(() => (initial?.ruta_id ? [initial.ruta_id] : []));
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  // Fotografía al abrir: base para detectar captura sin guardar.
  const [baseline, setBaseline] = useState<{ form: TarifaInput; rutaIds: string[] }>(() => ({
    form: buildInitialForm(agenteIdFijo ? { ...initial, agente_id: agenteIdFijo } : initial),
    rutaIds: initial?.ruta_id ? [initial.ruta_id] : [],
  }));

  const esEdicion = Boolean(tarifaId);
  const multiple = !esEdicion;

  useEffect(() => {
    if (open) {
      const inicial = buildInitialForm(agenteIdFijo ? { ...initial, agente_id: agenteIdFijo } : initial);
      const rutasIniciales = initial?.ruta_id ? [initial.ruta_id] : [];
      setForm(inicial);
      setRutaIds(rutasIniciales);
      setBaseline({ form: inicial, rutaIds: rutasIniciales });
      setIntentoEnvio(false);
    }
  }, [open, initial, agenteIdFijo]);

  const total = useMemo(() => calcularTotal(form), [form]);
  const valido = computeValido(esFormValido(form, { skipRutaId: multiple }), multiple, rutaIds.length);
  const pendiente = [crear, crearMultiples, actualizar].some((m) => m.isPending);
  const sucio = esTarifaSucia(form, baseline.form, rutaIds, baseline.rutaIds);

  // Errores siempre calculados para validación reactiva.
  const erroresLive = calcularErrores(form, rutaIds.length, multiple);
  // Sólo se pintan los campos en rojo después del primer intento (evita "mar de rojo" al abrir).
  const errores = intentoEnvio ? erroresLive : undefined;
  const faltantes = camposFaltantes(erroresLive);
  const tooltipFaltantes = faltantes.length > 0 ? `Faltan: ${faltantes.join(", ")}` : undefined;

  const ejecutarSubmit = useTarifaSubmit({
    mutations,
    form,
    rutaIds,
    esEdicion,
    tarifaId,
    onSuccess: () => onOpenChange(false),
    onPartialSuccess: (idsCreados) =>
      setRutaIds((prev) => prev.filter((id) => !idsCreados.has(id))),
  });

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!valido) return;
    ejecutarSubmit();
  };


  const guardarLabel = computeGuardarLabel({ pendiente, esEdicion, rutasCount: rutaIds.length });

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Tag}
      // Al guardar, `onSuccess` cierra con `onOpenChange(false)` directo: no
      // pasa por la guarda y por tanto no advierte.
      isDirty={sucio && !pendiente}
      title={getTituloModal(tituloOverride, esEdicion)}
      description={multiple
        ? "Captura la tarifa una sola vez y elige una o varias rutas para generarlas en lote."
        : "Captura o edita la tarifa marítima con sus costos y condiciones."}
      size="2xl"
      headerAside={
        <div className="text-right">
          <div className="text-overline">Total comparable</div>
          <div className="text-kpi text-foreground tabular-nums">{formatUSD(total)}</div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-body-sm text-muted-foreground" aria-live="polite">
            {tooltipFaltantes ?? "Listo para guardar."}
          </p>
          <div className="flex gap-2">
            <BotonCancelarTarifa disabled={pendiente} onCerrarSinGuarda={() => onOpenChange(false)} />

            <Button
              type="submit"
              form="tarifa-form"
              disabled={!valido}
              aria-busy={pendiente || undefined}
              title={pendiente ? "Guardando…" : tooltipFaltantes} loading={pendiente}>
              {guardarLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form id="tarifa-form" onSubmit={guardar} className="space-y-4">
        <EntidadesFields form={form} setForm={setForm} agentes={agentes} navieras={navieras} errores={errores} agenteIdFijo={agenteIdFijo} agenteNombreFijo={agenteNombreFijo} />
        <RutaTipoFields
          form={form}
          setForm={setForm}
          rutas={rutas}
          tipos={tipos}
          errores={errores}
          multiple={multiple}
          rutaIds={rutaIds}
          onRutaIdsChange={setRutaIds}
        />
        <NumerosFields form={form} setForm={setForm} errores={errores} />
        <VigenciaFields form={form} setForm={setForm} errores={errores} />

        <TarifaRecargosEditor
          value={form.recargos}
          onChange={(recargos: TarifaRecargoInput[]) => setForm({ ...form, recargos })}
        />

        <div>
          <Label htmlFor="tarifa-notas">Notas</Label>
          <Textarea
            id="tarifa-notas"
            value={form.notas ?? ""}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Condiciones, restricciones, comentarios del agente…"
          />
        </div>
      </form>
    </FormDialogShell>
  );
}
