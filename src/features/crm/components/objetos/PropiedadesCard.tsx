/**
 * Tarjeta "Propiedades" de una ficha del CRM: muestra y edita los campos
 * configurados por el súper administrador para ese objeto.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useGuardarValorCrm, usePropiedadesCrm, useValoresCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import type { ObjetoCrm } from "@/features/crm/services/propiedadesCrm";
import { CampoPropiedad } from "./CampoPropiedad";

interface Props { objeto: ObjetoCrm; registroId: string; canEdit: boolean }

export function PropiedadesCard({ objeto, registroId, canEdit }: Props) {
  const props = usePropiedadesCrm(objeto);
  const valores = useValoresCrm(registroId);
  const guardar = useGuardarValorCrm(registroId);
  const visibles = (props.data ?? []).filter((p) => !p.archivada);
  const cargando = props.isLoading || valores.isLoading;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-body font-semibold">Propiedades</CardTitle></CardHeader>
      <CardContent>
        {cargando && <p className="text-body-sm text-muted-foreground">Cargando…</p>}
        {(props.isError || valores.isError) && (
          <p className="text-body-sm text-destructive">No se pudieron cargar las propiedades.</p>
        )}
        {!cargando && visibles.length === 0 && (
          <p className="text-body-sm text-muted-foreground">Aún no hay propiedades para este objeto.</p>
        )}
        {!cargando && !valores.isError && (
          <div className="grid gap-3 md:grid-cols-2">
            {visibles.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <Label htmlFor={`prop-${p.id}`}>{p.etiqueta}{p.obligatoria && " *"}</Label>
                <CampoPropiedad
                  prop={p}
                  valor={valores.data?.find((v) => v.propiedad_id === p.id)}
                  disabled={!canEdit || guardar.isPending}
                  onGuardar={(valor) => guardar.mutate({ propiedadId: p.id, tipo: p.tipo, valor })}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
