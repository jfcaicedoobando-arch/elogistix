/**
 * Encabezado de una solicitud: folio, estado, reloj y acciones permitidas.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hint } from "@/components/shared/Hint";
import { useAccionSolicitud, useGuardarSolicitud } from "@/features/crm/hooks/usePricingCrm";
import { datosCopiaSolicitud } from "@/features/crm/services/pricing/copiaSolicitud";
import { ETIQUETA_ESTADO_PRICING, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { RelojPricing } from "./RelojPricing";

interface Props {
  solicitud: SolicitudPricingRow;
  puedeCancelar: boolean;
  puedeResponder: boolean;
  puedeEditar: boolean;
  puedeCopiar: boolean;
  onEditar: () => void;
  numOpciones: number;
}

export function AccionesSolicitudPricing({ solicitud: s, puedeCancelar, puedeResponder, puedeEditar, puedeCopiar, onEditar, numOpciones }: Props) {
  const accion = useAccionSolicitud();
  const copiar = useGuardarSolicitud();
  const sinOpciones = numOpciones === 0;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <span className="text-h4 font-semibold">{s.folio}</span>
        <Badge variant="outline">{ETIQUETA_ESTADO_PRICING[s.estado] ?? s.estado}</Badge>
        <RelojPricing enviadaAt={s.enviada_at} venceAt={s.vence_at} respondidaAt={s.respondida_at}
          cancelada={s.estado === "cancelada"} />
        <div className="ml-auto flex gap-2">
          {puedeCopiar && (
            <Button variant="outline" size="sm" disabled={copiar.isPending}
              onClick={() => copiar.mutate({ datos: datosCopiaSolicitud(s), enviar: true })}>Copiar y enviar</Button>
          )}
          {puedeEditar && (
            <Button variant="outline" size="sm" onClick={onEditar}>Editar</Button>
          )}
          {puedeCancelar && (
            <Button variant="outline" size="sm" disabled={accion.isPending}
              onClick={() => accion.mutate({ id: s.id, oportunidadId: s.oportunidad_id, accion: "cancelar" })}>Cancelar solicitud</Button>
          )}
          {puedeResponder && (
            <Hint label={sinOpciones ? "Agrega al menos una opción" : undefined}>
              <span tabIndex={sinOpciones ? 0 : undefined} aria-label={sinOpciones ? "Agrega al menos una opción para responder" : undefined}>
                <Button size="sm" disabled={accion.isPending || sinOpciones}
                  onClick={() => accion.mutate({ id: s.id, oportunidadId: s.oportunidad_id, accion: "responder" })}>Marcar respondida</Button>
              </span>
            </Hint>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
