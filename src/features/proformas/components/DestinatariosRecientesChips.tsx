/**
 * Fila de chips con los correos "Recientes" del cliente en el modal de envío.
 * Extraído de `EnviarProformaDialog` para respetar Power-of-10 #4 (≤200 líneas).
 */
import { X } from "lucide-react";
import { notifyInfo } from "@/lib/ui/appFeedback";

interface Props {
  sugerencias: string[];
  ocultos: string[];
  onAgregar: (email: string) => void;
  onOcultar: (email: string) => void;
  onRestaurar: (email: string) => void;
  onRestaurarVarios: (emails: string[]) => void;
}

export function DestinatariosRecientesChips({
  sugerencias,
  ocultos,
  onAgregar,
  onOcultar,
  onRestaurar,
  onRestaurarVarios,
}: Props) {
  if (sugerencias.length === 0 && ocultos.length === 0) return null;

  return (
    <>
      {sugerencias.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>Recientes:</span>
          {sugerencias.slice(0, 6).map((e) => (
            <span
              key={e}
              className="group inline-flex items-center gap-0.5 rounded border pl-1.5 pr-0.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
            >
              <button type="button" onClick={() => onAgregar(e)} className="outline-none">
                {e}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOcultar(e);
                  notifyInfo(undefined, {
                    title: "Correo ocultado",
                    description: e,
                    action: { label: "Deshacer", onClick: () => onRestaurar(e) },
                  });
                }}
                aria-label={`Ocultar ${e}`}
                className="rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {ocultos.length > 0 && (
        <Button
          variant="link"
          size="sm"
          onClick={() => onRestaurarVarios(ocultos)}
          className="mt-1 h-auto p-0 text-xs text-muted-foreground underline-offset-2"
        >
          Restaurar ocultos ({ocultos.length})
        </button>
      )}
    </>
  );
}
