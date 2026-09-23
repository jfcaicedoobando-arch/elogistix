import {
  contextoPuerto, nombrePuerto,
} from "@/features/costeo/utils/puertoLabel";

/** Nombre y contexto inequívoco del puerto sin ensanchar la tabla. */
export function PuertoCelda({ puerto }: {
  puerto: Parameters<typeof contextoPuerto>[0];
}) {
  const contexto = contextoPuerto(puerto);
  return (
    <div className="min-w-0">
      <div className="font-medium">{nombrePuerto(puerto)}</div>
      {contexto && <div className="text-label text-muted-foreground">{contexto}</div>}
    </div>
  );
}