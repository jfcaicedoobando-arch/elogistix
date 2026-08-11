/**
 * v13.507.0 — Hereda al formulario de captura lo que operaciones ya declaró en
 * el buzón: proveedor y nota para contabilidad.
 *
 * Se aplica una sola vez por documento y nunca pisa lo que el contador ya
 * escribió o eligió a mano.
 */
import { useEffect, useRef } from "react";
import type { EntranteParaCaptura } from "@/features/cxp/types";

interface Args {
  entrante: EntranteParaCaptura | null | undefined;
  abierto: boolean;
  provIdActual: string;
  notaActual: string;
  onProveedor: (id: string, nombre: string) => void;
  onNota: (nota: string) => void;
}

export function useHerenciaEntrante({
  entrante, abierto, provIdActual, notaActual, onProveedor, onNota,
}: Args) {
  const aplicadoPara = useRef<string | null>(null);
  const estado = useRef({ provIdActual, notaActual, onProveedor, onNota });
  estado.current = { provIdActual, notaActual, onProveedor, onNota };

  useEffect(() => {
    if (!abierto || !entrante) return;
    if (aplicadoPara.current === entrante.id) return;
    aplicadoPara.current = entrante.id;

    const { provIdActual: prov, notaActual: nota, onProveedor: setProv, onNota: setNota } =
      estado.current;

    if (entrante.proveedorId && !prov) {
      setProv(entrante.proveedorId, entrante.proveedorNombre ?? "Proveedor");
    }
    const heredable = (entrante.notaOperaciones ?? "").trim();
    if (heredable && !nota.trim()) setNota(heredable);
  }, [abierto, entrante]);

  useEffect(() => {
    if (!abierto) aplicadoPara.current = null;
  }, [abierto]);
}
