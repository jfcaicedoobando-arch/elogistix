/**
 * Lista de propiedades de un objeto + alta rápida (solo súper administrador).
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useCrearPropiedad, usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import type { ObjetoCrm, TipoPropiedad } from "@/features/crm/services/propiedadesCrm";
import { PropiedadAdminFila } from "./PropiedadAdminFila";
import { ETIQUETA_TIPO } from "./etiquetasTipo";

export function ListaPropiedadesAdmin({ objeto }: { objeto: ObjetoCrm }) {
  const q = usePropiedadesCrm(objeto);
  const crear = useCrearPropiedad();
  const [etiqueta, setEtiqueta] = useState("");
  const [tipo, setTipo] = useState<TipoPropiedad>("texto");
  const lista = q.data ?? [];

  if (q.isError) return <ErrorState title="No se pudieron cargar las propiedades" onRetry={() => void q.refetch()} />;

  const agregar = () => {
    const orden = Math.max(0, ...lista.map((p) => p.orden)) + 1;
    crear.mutate({ objeto, etiqueta, tipo, orden }, { onSuccess: () => setEtiqueta("") });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Nombre de la nueva propiedad"
          className="h-9 max-w-sm" maxLength={120} aria-label="Nombre de la nueva propiedad" />
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPropiedad)}>
          <SelectTrigger className="h-9 w-56" aria-label="Tipo de propiedad"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ETIQUETA_TIPO) as TipoPropiedad[]).map((t) => (
              <SelectItem key={t} value={t}>{ETIQUETA_TIPO[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={agregar} disabled={!etiqueta.trim() || crear.isPending}><Plus className="h-4 w-4" /> Crear propiedad</Button>
      </div>
      {q.isLoading && <p className="text-body-sm text-muted-foreground">Cargando…</p>}
      {lista.map((p, i) => (
        <PropiedadAdminFila key={p.id} prop={p} anterior={lista[i - 1]} siguiente={lista[i + 1]} />
      ))}
    </div>
  );
}
