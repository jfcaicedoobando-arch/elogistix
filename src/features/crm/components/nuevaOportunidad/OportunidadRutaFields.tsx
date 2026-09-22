/**
 * Campos de ruta de la oportunidad (modo, origen, destino).
 *
 * Etapa 4: el modo es un Select controlado y, en Marítimo, origen/destino usan
 * el buscador de puertos del catálogo (texto + ID atómicos, con texto libre
 * permitido). La lógica de transición vive en `domain/oportunidadRuta.ts`.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PortSelect } from "@/features/catalogos";
import type { OportunidadFormState } from "@/features/crm/hooks";
import {
  MODOS_OPORTUNIDAD,
  aplicarCambioModo,
  aplicarCambioPuerto,
  esModoMaritimo,
  normalizarModoOportunidad,
} from "@/features/crm/domain/oportunidadRuta";

interface Props {
  form: OportunidadFormState;
  set: <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) => void;
  setForm?: React.Dispatch<React.SetStateAction<OportunidadFormState>>;
}

export default function OportunidadRutaFields({ form, set, setForm }: Props) {
  const { advertencia } = normalizarModoOportunidad(form.modo);
  const maritimo = esModoMaritimo(form.modo);
  const modoConocido = MODOS_OPORTUNIDAD.some((m) => m === form.modo);

  const cambiarModo = (modo: string) => {
    if (setForm) setForm((f) => aplicarCambioModo(f, modo));
    else set("modo", modo);
  };
  const cambiarPuerto = (extremo: "origen" | "destino") =>
    (texto: string, puertoId: string | null) => {
      if (setForm) setForm((f) => aplicarCambioPuerto(f, extremo, texto, puertoId));
      else set(extremo, texto);
    };

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="op-modo">Modo</Label>
        <Select value={modoConocido ? form.modo : ""} onValueChange={cambiarModo}>
          <SelectTrigger id="op-modo" aria-invalid={Boolean(advertencia)}>
            <SelectValue placeholder="Selecciona modo" />
          </SelectTrigger>
          <SelectContent>
            {MODOS_OPORTUNIDAD.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {advertencia && (
          <p role="alert" className="text-body-sm text-destructive">{advertencia}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-origen">Origen</Label>
        {maritimo ? (
          <PortSelect
            value={form.origen}
            onValueChange={cambiarPuerto("origen")}
            placeholder="Puerto de origen"
          />
        ) : (
          <Input id="op-origen" value={form.origen} onChange={(e) => set("origen", e.target.value)} />
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-destino">Destino</Label>
        {maritimo ? (
          <PortSelect
            value={form.destino}
            onValueChange={cambiarPuerto("destino")}
            placeholder="Puerto de destino"
          />
        ) : (
          <Input id="op-destino" value={form.destino} onChange={(e) => set("destino", e.target.value)} />
        )}
      </div>
    </>
  );
}
