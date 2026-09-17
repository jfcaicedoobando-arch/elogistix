/**
 * Hook que encapsula la lógica de "conciliar exactos" (auto-matching)
 * de la pantalla de conciliación bancaria. Extraído de
 * `TesoreriaConciliacion` para bajar su complejidad ciclomática.
 */
import { useState } from "react";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { sugerirCandidatosDetalle } from "@/features/tesoreria/services/sugerirCandidatos";
import { encontrarCandidatosExactos, seleccionarMatchUnico } from "@/features/tesoreria/domain/conciliacionMatcher";

import type { MovimientoBBVA } from "@/features/tesoreria/services";

interface ConciliarPagoInput {
  movId: string;
  tipo: "cxc" | "cxp";
  pagoId: string;
}

export function useAutoConciliarExactos(
  movs: MovimientoBBVA[],
  conciliarPagoAsync: (input: ConciliarPagoInput) => Promise<unknown>,
) {
  const [isAutoConciliando, setIsAutoConciliando] = useState(false);

  const handleConciliarExactos = async () => {
    if (!movs.length) return;
    setIsAutoConciliando(true);
    let conciliados = 0;
    let revision = 0;

    const pendientes = movs.filter((m) => m.estado_conciliacion === "Pendiente");

    for (const m of pendientes) {
      try {
        const { candidatos, truncado } = await sugerirCandidatosDetalle(m);
        const exactos = encontrarCandidatosExactos(m, candidatos);
        // MNY: con la lista recortada por el tope puede existir otra
        // coincidencia exacta que no se leyó; la unicidad NO está comprobada,
        // así que se manda a revisión manual en vez de conciliar a ciegas.
        const unico = truncado ? null : seleccionarMatchUnico(exactos);

        if (unico) {
          // Usamos mutateAsync para esperar el resultado antes de contar éxito
          await conciliarPagoAsync({
            movId: m.id,
            tipo: unico.tipo,
            pagoId: unico.pago_id,
          });
          conciliados++;
        } else {
          revision++;
        }
      } catch {
        // Falló el guard o la red, cuenta como revisión
        revision++;
      }
    }

    }

    if (conciliados > 0) {
      notifySuccess(undefined, {
        title: `${conciliados} movimientos conciliados automáticamente`,
        description: revision > 0 ? `${revision} requieren revisión manual` : undefined,
      });
    } else if (revision > 0) {
      notifyWarning(undefined, {
        title: "No se encontraron matches exactos únicos",
        description: `${revision} movimientos pendientes requieren revisión`,
      });
    }
    setIsAutoConciliando(false);
  };

  return { isAutoConciliando, handleConciliarExactos };
}
