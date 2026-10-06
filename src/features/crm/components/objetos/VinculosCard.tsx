/**
 * Tarjeta de registros ligados (p. ej. "Contactos" dentro de una Empresa).
 * Permite navegar, ligar uno existente y quitar el vínculo (no borra el registro).
 */
import { Link } from "react-router";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRelacionCrm, useVinculoCrm, type Relacion } from "@/features/crm/hooks/useObjetosCrm";
import type { TipoVinculo } from "@/features/crm/services/vinculosCrm";
import { BuscadorObjetoCrm } from "./BuscadorObjetoCrm";

interface Props {
  titulo: string;
  relacion: Relacion;
  duenoId: string;
  rutaBase: string;
  /** Si se omite, la tarjeta es de solo lectura. */
  edicion?: {
    tipo: TipoVinculo;
    objeto: "empresa" | "contacto";
    /** Ordena los ids según la tabla del vínculo. */
    par: (otroId: string) => { aId: string; bId: string };
  };
  canEdit: boolean;
}

export function VinculosCard({ titulo, relacion, duenoId, rutaBase, edicion, canEdit }: Props) {
  const { data = [], isLoading, isError } = useRelacionCrm(relacion, duenoId);
  const vinculo = useVinculoCrm();
  const editable = canEdit && !!edicion;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-body font-semibold">{titulo} ({data.length})</CardTitle>
        {editable && (
          <BuscadorObjetoCrm
            objeto={edicion.objeto}
            excluir={data.map((d) => d.id)}
            disabled={vinculo.isPending}
            onElegir={(id) => vinculo.mutate({ tipo: edicion.tipo, ...edicion.par(id) })}
          />
        )}
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-body-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-body-sm text-destructive">No se pudieron cargar los vínculos.</p>}
        {!isLoading && !isError && data.length === 0 && (
          <p className="text-body-sm text-muted-foreground">Sin registros ligados.</p>
        )}
        <ul className="divide-y">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <Link to={`${rutaBase}/${r.id}`} className="text-body-sm text-primary hover:underline">
                {r.nombre}
              </Link>
              {editable && (
                <Button
                  size="icon" variant="ghost" className="h-7 w-7"
                  aria-label={`Quitar vínculo con ${r.nombre}`}
                  disabled={vinculo.isPending}
                  onClick={() => vinculo.mutate({ tipo: edicion.tipo, ...edicion.par(r.id), quitar: true })}
                >
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
