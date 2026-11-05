/**
 * Paso de autorización interna: el comercial la solicita y un administrador
 * o el gerente comercial la autoriza (justificación si el margen queda bajo).
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAutorizacionCotizacion } from "@/features/cotizacion/hooks/useAutorizacionCotizacion";
import { estadoAutorizacion } from "@/features/cotizacion/domain/autorizacionCotizacion";

interface Props {
  cotizacionId: string;
  estado: string;
  autorizadaAt: string | null;
  solicitadaAt: string | null;
  margenAutorizado: number | null;
  puedeSolicitar: boolean;
  puedeAutorizar: boolean;
  tieneTotal: boolean;
}

export function AutorizacionCotizacion(p: Props) {
  const m = useAutorizacionCotizacion();
  const [motivo, setMotivo] = useState("");
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const est = estadoAutorizacion({ estado: p.estado, autorizada_at: p.autorizadaAt, autorizacion_solicitada_at: p.solicitadaAt });
  if (est === "no_aplica") return null;
  if (est === "autorizada") {
    return <Badge variant="success">Autorizada{p.margenAutorizado != null ? ` · margen ${p.margenAutorizado} %` : ""}</Badge>;
  }
  const autorizar = () => m.mutate({ tipo: "autorizar", id: p.cotizacionId, motivo: motivo.trim() || null }, {
    onError: (e) => { if (String((e as { message?: string }).message ?? "").includes("LC_COT_MARGEN_BAJO_MINIMO")) setPedirMotivo(true); },
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={est === "por_autorizar" ? "warning" : "neutral"}>
        {est === "por_autorizar" ? "Por autorizar" : "Sin autorizar"}
      </Badge>
      {est === "sin_solicitar" && p.puedeSolicitar && p.tieneTotal && !p.puedeAutorizar && (
        <Button size="sm" variant="outline" disabled={m.isPending}
          onClick={() => m.mutate({ tipo: "solicitar", id: p.cotizacionId })}>Solicitar autorización</Button>
      )}
      {p.puedeAutorizar && p.tieneTotal && (
        <Button size="sm" disabled={m.isPending || (pedirMotivo && motivo.trim().length < 10)} onClick={autorizar}>Autorizar</Button>
      )}
      {pedirMotivo && (
        <Textarea aria-label="Justificación de margen bajo" rows={2} className="basis-full"
          placeholder="El margen está bajo el mínimo: explica por qué se autoriza (mín. 10 caracteres)"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      )}
    </div>
  );
}
