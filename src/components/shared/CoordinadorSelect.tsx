import { useMutation, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fetchCoordinadores } from "@/lib/operaciones/coordinador";
import { queryKeys } from "@/lib/query";

const SIN_ASIGNAR = "sin_asignar";

interface Props {
  value: string | null;
  label: string;
  editable: boolean;
  permitirVacio?: boolean;
  onGuardar: (coordinadorId: string | null) => Promise<void>;
  onGuardado: () => void;
}

/** Muestra el coordinador; si el rol puede, permite cambiarlo con un RPC validado en la base. */
export function CoordinadorSelect({ value, label, editable, permitirVacio, onGuardar, onGuardado }: Props) {
  const { organizationId } = useOrganization();
  const opciones = useQuery({
    queryKey: queryKeys.cotizaciones.coordinadores(organizationId),
    enabled: Boolean(organizationId),
    queryFn: () => (organizationId ? fetchCoordinadores(organizationId) : Promise.resolve({ opciones: [], nombres: new Map<string, string>() })),
  });
  const mutation = useMutation({
    mutationFn: onGuardar,
    onSuccess: () => { notifySuccess(undefined, { title: "Coordinador actualizado" }); onGuardado(); },
    onError: (error) => notifyError(undefined, { title: "No se pudo cambiar el coordinador", error }),
  });
  const nombre = nombreDe(opciones.data, value);

  if (!editable) {
    return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{nombre}</dd></div>;
  }
  return (
    <div className="min-w-0 space-y-1">
      <label className="text-muted-foreground block" htmlFor={`coord-${label}`}>{label}</label>
      <Select
        value={value ?? SIN_ASIGNAR}
        disabled={mutation.isPending || opciones.isLoading}
        onValueChange={(v) => mutation.mutate(v === SIN_ASIGNAR ? null : v)}
      >
        <SelectTrigger id={`coord-${label}`} aria-label={label}><SelectValue placeholder="Sin asignar" /></SelectTrigger>
        <SelectContent>
          {(permitirVacio || !value) && <SelectItem value={SIN_ASIGNAR} disabled={!permitirVacio}>Sin asignar</SelectItem>}
          {value && !opciones.data?.opciones.some((o) => o.id === value) && <SelectItem value={value}>{nombre}</SelectItem>}
          {(opciones.data?.opciones ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function nombreDe(data: { nombres: Map<string, string> } | undefined, id: string | null): string {
  if (!id) return "Sin asignar";
  return data?.nombres.get(id) ?? "—";
}
