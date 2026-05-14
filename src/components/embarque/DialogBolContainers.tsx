import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Search, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { formatDate } from "@/lib/formatters";
import {
  useJsonCargoBolLookup,
  type BolLookupResponse,
} from "@/hooks/embarque/useJsonCargoBolLookup";
import { useSyncJsonCargo, PrefixMismatchError } from "@/hooks/embarque/useJsonCargoTracking";
import { useActualizarContenedorEmbarque } from "@/hooks/embarque/mutations/useActualizarContenedorEmbarque";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  blMaster: string | null;
  naviera: string | null;
  contenedorActual: string | null;
}

export function DialogBolContainers({
  open,
  onOpenChange,
  embarqueId,
  blMaster,
  naviera,
  contenedorActual,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const lookup = useJsonCargoBolLookup();
  const sync = useSyncJsonCargo();
  const actualizarContenedor = useActualizarContenedorEmbarque();
  const [result, setResult] = useState<BolLookupResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setResult(null);
      setSelected(contenedorActual ?? null);
    }
  }, [open, contenedorActual]);

  const handleBuscar = async () => {
    try {
      const res = await lookup.mutateAsync(embarqueId);
      setResult(res);
      if (!res.ok) {
        notifyError(toast, {
          title: "No se pudo consultar BL",
          description: res.error ?? "Error desconocido",
        });
        return;
      }
      // Preselecciona el contenedor actual si está en la lista
      if (contenedorActual && res.associated_container_numbers?.includes(contenedorActual)) {
        setSelected(contenedorActual);
      } else if ((res.associated_container_numbers?.length ?? 0) === 1) {
        setSelected(res.associated_container_numbers![0]);
      }
    } catch (err) {
      notifyError(toast, {
        title: "Error en consulta BL",
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  };

  const handleGuardar = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // 1. Actualizar contenedor del embarque
      await actualizarContenedor.mutateAsync({ embarqueId, contenedor: selected });

      // 2. Sincronizar tracking del contenedor elegido
      try {
        const syncRes = await sync.mutateAsync({
          embarqueId,
          contenedor: selected,
          naviera,
        });
        if (syncRes.ok) {
          notifySuccess(toast, {
            title: "Contenedor guardado y sincronizado",
            description: syncRes.eventos_creados
              ? `${syncRes.eventos_creados} evento(s) nuevo(s).`
              : "Tracking actualizado.",
          });
        } else {
          notifySuccess(toast, {
            title: "Contenedor guardado",
            description: syncRes.error ?? "Sincronización pendiente.",
          });
        }
      } catch (syncErr) {
        if (syncErr instanceof PrefixMismatchError) {
          notifyError(toast, {
            title: "Contenedor guardado, pero prefix no coincide",
            description: `Prefix ${syncErr.prefix} no corresponde a ${naviera ?? "—"}.`,
          });
        } else {
          notifyError(toast, {
            title: "Contenedor guardado, error al sincronizar",
            description: syncErr instanceof Error ? syncErr.message : "Error",
          });
        }
      }

      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.jsonCargo.byEmbarque(embarqueId) });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo guardar el contenedor",
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  const containers = result?.ok ? result.associated_container_numbers ?? [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contenedores del BL Master</DialogTitle>
          <DialogDescription>
            Consulta JSONCargo para listar los contenedores asociados al BL{" "}
            <span className="font-mono">{blMaster ?? "—"}</span> y selecciona el de este embarque.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="py-4">
            <Button onClick={handleBuscar} disabled={lookup.isPending} className="w-full">
              {lookup.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar contenedores
            </Button>
          </div>
        )}

        {result && !result.ok && (
          <div className="flex items-start gap-2 text-xs text-destructive p-3 rounded bg-destructive/5 border border-destructive/20">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">No se obtuvieron contenedores</p>
              <p className="mt-0.5">{result.error ?? "—"}</p>
            </div>
          </div>
        )}

        {result?.ok && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{result.shipping_line_name}</Badge>
              <Badge variant="outline">{result.associated_containers} contenedor(es)</Badge>
              {result.last_updated && (
                <span className="text-muted-foreground">
                  Actualizado: {formatDate(result.last_updated, "dd MMM yyyy HH:mm")}
                </span>
              )}
            </div>

            {containers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay contenedores asociados.</p>
            ) : (
              <RadioGroup
                value={selected ?? ""}
                onValueChange={setSelected}
                className="max-h-72 overflow-y-auto space-y-1 pr-1"
              >
                {containers.map((c) => {
                  const isCurrent = c === contenedorActual;
                  return (
                    <Label
                      key={c}
                      htmlFor={`bol-${c}`}
                      className="flex items-center gap-2 rounded border p-2 cursor-pointer hover:bg-muted/40 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5"
                    >
                      <RadioGroupItem id={`bol-${c}`} value={c} />
                      <span className="font-mono text-sm flex-1">{c}</span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">actual</Badge>
                      )}
                    </Label>
                  );
                })}
              </RadioGroup>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleBuscar}
              disabled={lookup.isPending}
              className="text-xs h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${lookup.isPending ? "animate-spin" : ""}`} />
              Reintentar
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {result?.ok && containers.length > 0 && (
            <Button
              onClick={handleGuardar}
              disabled={!selected || saving || selected === contenedorActual && false}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar y sincronizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
