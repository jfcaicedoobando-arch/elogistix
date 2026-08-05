/**
 * v13.303.35 — Selectores de Agente y Naviera para embarques.
 *
 * Ambos vienen precargados desde la tarifa vinculada de la cotización.
 * Muestran badge "Cotización" cuando el valor coincide con el heredado y
 * permiten un override manual (con opción de restaurar).
 */
import { useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Undo2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavieras } from "@/features/catalogos/hooks/useNavieras";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { opcionesConValorGuardado } from "@/features/embarques/domain/opcionesCatalogo";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const NONE = "__none__";

function BadgeHerencia({ heredado }: { heredado: boolean }) {
  if (!heredado) return null;
  return (
    <Badge variant="secondary" className="text-2xs font-normal">
      Cotización
    </Badge>
  );
}

export function AgenteEmbarqueSelector({ cotizacionAgenteId }: { cotizacionAgenteId?: string | null }) {
  const { setValue, watch } = useFormContext<EmbarqueFormValues>();
  const { data: agentes = [] } = useCosteoAgentes();
  const currentId = watch("agenteId");
  const nombreGuardado = watch("agente");
  const heredado = !!cotizacionAgenteId && currentId === cotizacionAgenteId;
  const overriden = !!cotizacionAgenteId && currentId !== cotizacionAgenteId;

  // P1-5: si el catálogo aún no trae el agente guardado (o está inactivo), se
  // inyecta una opción sintética para no pintar el select vacío.
  const opciones = useMemo(
    () =>
      opcionesConValorGuardado(
        agentes.filter((a) => a.activo).map((a) => ({ id: a.id, label: a.nombre })),
        currentId,
        nombreGuardado,
      ),
    [agentes, currentId, nombreGuardado],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Agente {heredado && <BadgeHerencia heredado />}</Label>
        {overriden && cotizacionAgenteId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              const original = agentes.find((a) => a.id === cotizacionAgenteId);
              setValue("agenteId", cotizacionAgenteId, { shouldValidate: true, shouldDirty: true });
              setValue("agente", original?.nombre ?? "", { shouldValidate: true, shouldDirty: true });
            }}
          >
            <Undo2 className="h-3 w-3" /> Restaurar
          </Button>
        ) : null}
      </div>
      <Controller
        name="agenteId"
        render={({ field }) => (
          <Select
            value={field.value ?? NONE}
            onValueChange={(v) => {
              const id = v === NONE ? null : v;
              field.onChange(id);
              const nombre = id ? (agentes.find((a) => a.id === id)?.nombre ?? "") : "";
              setValue("agente", nombre, { shouldValidate: true, shouldDirty: true });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin agente asignado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin agente</SelectItem>
              {opciones.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {overriden ? (
        <p className="text-label text-muted-foreground">
          Cambiaste el agente heredado de la cotización.
        </p>
      ) : null}
    </div>
  );
}

export function NavieraEmbarqueSelector({
  cotizacionNavieraId,
  className,
}: {
  cotizacionNavieraId?: string | null;
  className?: string;
}) {
  const { setValue, watch } = useFormContext<EmbarqueFormValues>();
  const { data: navieras = [] } = useNavieras();
  const currentId = watch("navieraId");
  const nombreGuardado = watch("naviera");
  const heredado = !!cotizacionNavieraId && currentId === cotizacionNavieraId;
  const overriden = !!cotizacionNavieraId && currentId !== cotizacionNavieraId;

  // P1-5: misma tolerancia que en el selector de agente.
  const opciones = useMemo(
    () =>
      opcionesConValorGuardado(
        navieras.map((n) => ({ id: n.id, label: n.name })),
        currentId,
        nombreGuardado,
      ),
    [navieras, currentId, nombreGuardado],
  );

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>Naviera * {heredado && <BadgeHerencia heredado />}</Label>
        {overriden && cotizacionNavieraId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              const original = navieras.find((n) => n.id === cotizacionNavieraId);
              setValue("navieraId", cotizacionNavieraId, { shouldValidate: true, shouldDirty: true });
              setValue("naviera", original?.name ?? "", { shouldValidate: true, shouldDirty: true });
            }}
          >
            <Undo2 className="h-3 w-3" /> Restaurar
          </Button>
        ) : null}
      </div>
      <Controller
        name="navieraId"
        render={({ field }) => (
          <Select
            value={field.value ?? NONE}
            onValueChange={(v) => {
              const id = v === NONE ? null : v;
              field.onChange(id);
              const nombre = id ? (navieras.find((n) => n.id === id)?.name ?? "") : "";
              setValue("naviera", nombre, { shouldValidate: true, shouldDirty: true });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar naviera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin naviera</SelectItem>
              {opciones.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {overriden ? (
        <p className="text-label text-muted-foreground">
          Cambiaste la naviera heredada de la cotización.
        </p>
      ) : null}
    </div>
  );
}
