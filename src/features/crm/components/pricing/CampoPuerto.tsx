/**
 * Buscador de puerto para la solicitud de pricing: muestra solo los puertos
 * del país elegido y guarda la etiqueta "Nombre, País (CÓDIGO)" como texto.
 */
import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { PortIdSelect, etiquetaPuerto, type PuertoOption } from "@/features/catalogos";
import { idDeEtiqueta, puertosDePais } from "@/features/crm/services/pricing/puertosPorPais";

interface Props {
  id: string;
  label: string;
  pais: string | null | undefined;
  value: string | null | undefined;
  onChange: (etiqueta: string | null) => void;
  puertos: readonly PuertoOption[];
  disabled?: boolean;
  /** Etiqueta del otro extremo, para no permitir el mismo puerto dos veces. */
  excluirEtiqueta?: string | null;
}

export function CampoPuerto({ id, label, pais, value, onChange, puertos, disabled, excluirEtiqueta }: Props) {
  const lista = useMemo(() => puertosDePais(puertos, pais), [puertos, pais]);
  const excluirId = idDeEtiqueta(lista, excluirEtiqueta);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <PortIdSelect
        id={id}
        value={idDeEtiqueta(lista, value)}
        onChange={(puertoId) => {
          const p = lista.find((x) => x.id === puertoId);
          onChange(p ? etiquetaPuerto(p) : null);
        }}
        puertos={lista}
        excludeId={excluirId || undefined}
        disabled={disabled || !pais}
        placeholder={pais ? "Buscar puerto…" : "Elige primero el país"}
      />
    </div>
  );
}
