/**
 * v13.510.0 — Resuelve la categoría contable cuando la captura nace del buzón.
 *
 * Si el documento se originó en un embarque, su naturaleza contable es costo
 * directo (COGS): se fija automáticamente esa categoría de la organización y se
 * bloquea el selector, con la posibilidad de desbloquearlo a mano.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoriaPresupuestoLite } from "@/features/cxp/types";

interface Args {
  categorias: readonly CategoriaPresupuestoLite[];
  /** Documento del buzón que originó la captura (null en captura manual). */
  documentoId: string | null | undefined;
  expediente?: string | null;
  abierto: boolean;
  categoriaActual: string;
  onCategoria: (id: string) => void;
}

export interface CategoriaCogsBuzon {
  /** El selector debe mostrarse bloqueado. */
  bloqueada: boolean;
  motivo?: string;
  desbloquear: () => void;
  /** Aviso cuando no hay categoría COGS activa configurada. */
  avisoSinCogs?: string;
}

export function encontrarCategoriaCogs(
  categorias: readonly CategoriaPresupuestoLite[],
): CategoriaPresupuestoLite | null {
  return categorias.find((c) => c.tipo_contable === "CostoDirectoEmbarque") ?? null;
}

const AVISO_SIN_COGS =
  "Esta organización no tiene una categoría de costo directo de embarque activa: configúrala en Presupuesto › Categorías.";

export function useCategoriaCogsBuzon({
  categorias, documentoId, expediente, abierto, categoriaActual, onCategoria,
}: Args): CategoriaCogsBuzon {
  const [desbloqueada, setDesbloqueada] = useState(false);
  const aplicadoPara = useRef<string | null>(null);
  const cogs = encontrarCategoriaCogs(categorias);

  const estado = useRef({ categoriaActual, onCategoria });
  estado.current = { categoriaActual, onCategoria };

  useEffect(() => {
    if (!abierto || !documentoId || !cogs) return;
    if (aplicadoPara.current === documentoId) return;
    aplicadoPara.current = documentoId;
    // No pisamos una elección previa distinta hecha por el contador.
    if (!estado.current.categoriaActual) estado.current.onCategoria(cogs.id);
  }, [abierto, documentoId, cogs]);

  useEffect(() => {
    if (!abierto) {
      aplicadoPara.current = null;
      setDesbloqueada(false);
    }
  }, [abierto]);

  const desbloquear = useCallback(() => setDesbloqueada(true), []);

  if (!documentoId) return { bloqueada: false, desbloquear };
  if (!cogs) return { bloqueada: false, desbloquear, avisoSinCogs: AVISO_SIN_COGS };

  const enCogs = categoriaActual === cogs.id;
  return {
    bloqueada: !desbloqueada && enCogs,
    motivo: expediente
      ? `Costo directo de embarque: el documento nació del expediente ${expediente}.`
      : "Costo directo de embarque: el documento nació de un embarque.",
    desbloquear,
  };
}
