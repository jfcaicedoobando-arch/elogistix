/**
 * Tarjeta "Propiedades" de una ficha del CRM: muestra y edita los campos
 * configurados por el súper administrador para ese objeto.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { usePropiedadesCrm, useValoresCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import { useAutoguardadoPropiedadesCrm, type EstadoAutoguardado } from "@/features/crm/hooks/useAutoguardadoPropiedadesCrm";
import type { ObjetoCrm, TipoPropiedad } from "@/features/crm/services/propiedadesCrm";
import { filaValor, type ValorCrm, type ValorEntrada } from "@/features/crm/services/valoresCrm";
import { CampoPropiedad } from "./CampoPropiedad";

interface Props { objeto: ObjetoCrm; registroId: string; canEdit: boolean }

export function PropiedadesCard({ objeto, registroId, canEdit }: Props) {
  return <PropiedadesContenido key={`${objeto}:${registroId}`} objeto={objeto} registroId={registroId} canEdit={canEdit} />;
}

function mismoValor(a: ValorCrm | undefined, visible: ValorEntrada, tipo: TipoPropiedad) {
  if (!a) return false;
  let b;
  try { b = filaValor(tipo, visible); } catch { return false; }
  const columnas = ["valor_texto", "valor_numero", "valor_fecha"] as const;
  return columnas.every((columna) => a[columna] === (b?.[columna] ?? null))
    && JSON.stringify([...(a.opcion_ids ?? [])].sort()) === JSON.stringify([...(b?.opcion_ids ?? [])].sort());
}

function EstadoCampo({ id, estado, coincide, consultando }: {
  id: string; estado?: EstadoAutoguardado; coincide: boolean; consultando: boolean;
}) {
  const textos = {
    editando: "Cambios sin guardar",
    guardando: "Guardando…",
    guardado: "Guardado",
    error: "No se pudo guardar. Vuelve a intentarlo al salir del campo o al elegir una opción.",
    conflicto: "El valor cambió mientras editabas. Revisa el valor actual antes de volver a guardar.",
  };
  const confirmado = consultando
    ? "Cambio guardado. Actualizando el campo…"
    : "El cambio se guardó, pero el campo muestra otro valor. Revisa la captura antes de continuar.";
  return (
    <p id={id} role={estado === "error" || estado === "conflicto" ? "alert" : "status"}
      className={`min-h-4 text-body-sm ${estado === "error" ? "text-destructive" : "text-muted-foreground"}`}>
      {estado === "guardado" && !coincide ? confirmado : estado ? textos[estado] : ""}
    </p>
  );
}

function PropiedadesContenido({ objeto, registroId, canEdit }: Props) {
  const props = usePropiedadesCrm(objeto);
  const valores = useValoresCrm(registroId);
  const guardar = useAutoguardadoPropiedadesCrm(registroId);
  const visibles = (props.data ?? []).filter((p) => !p.archivada);
  const cargando = props.isLoading || valores.isLoading;
  const hayConfirmados = Object.values(guardar.estados).includes("guardado");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body font-semibold">Propiedades</CardTitle>
        {canEdit && <CardDescription>Los cambios se guardan al salir de cada campo o al elegir una opción.</CardDescription>}
      </CardHeader>
      <CardContent>
        {cargando && <EmptyStateInline loading message="Cargando propiedades…" density="compact" />}
        {(props.isError || valores.isError) && (
          <ErrorStateInline
            message={hayConfirmados
              ? "Hay cambios guardados, pero no se pudieron actualizar las propiedades. Reintenta la consulta para ver los valores actuales."
              : "No se pudieron cargar las propiedades."}
            onRetry={() => { void props.refetch(); void valores.refetch(); }} />
        )}
        {!cargando && !props.isError && !valores.isError && visibles.length === 0 && (
          <EmptyStateInline message="Aún no hay propiedades para este objeto." density="compact" />
        )}
        {!cargando && !props.isError && !valores.isError && (
          <div className="grid gap-3 md:grid-cols-2">
            {visibles.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <Label htmlFor={`prop-${p.id}`}>{p.etiqueta}{p.obligatoria && " *"}</Label>
                <CampoPropiedad
                  prop={p}
                  valor={valores.data?.find((v) => v.propiedad_id === p.id)}
                  disabled={!canEdit || guardar.isPending}
                  conflicto={guardar.estados[p.id] === "conflicto"}
                  consultando={valores.isFetching}
                  onEditar={(tieneCambios) => guardar.editar(p.id, tieneCambios)}
                  descripcionId={`estado-prop-${p.id}`}
                  onGuardar={(valor, version) => guardar.guardarCampo({ propiedadId: p.id, tipo: p.tipo, valor, version })}
                  renderEstado={(visible) => <EstadoCampo id={`estado-prop-${p.id}`} estado={guardar.estados[p.id]}
                    coincide={mismoValor(guardar.confirmados[p.id], visible, p.tipo)} consultando={valores.isFetching} />}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
