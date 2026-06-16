---
name: Cotización · tarifa vinculada
description: La tarifa marítima del módulo Costeo es la fuente de verdad para tránsito, días libres y carta garantía en el wizard de cotización
type: feature
---

Flujo desde v13.26.0:

- En Paso 1 del wizard de cotización marítima existe el panel `<TarifaVinculadaPanel>` (ya integrado en `PasoDatosGenerales.tsx`).
- Al elegir tarifa desde `BuscarTarifaDialog` se persiste `cotizaciones.tarifa_id` (FK a `costeo_tarifas`, `ON DELETE SET NULL`) y se autollenan en el form RHF: `tiempoTransitoDias`, `diasLibresDestino`, `cartaGarantia` y `tipoContenedor`.
- Los inputs autorellenados quedan `readOnly` con badge "Tarifa". Si el usuario edita uno, se marca en `cotizaciones.tarifa_override` (jsonb `{ campo: true }`) y aparece banner con "Restaurar desde tarifa".
- Carta garantía: cuando hay tarifa, en lugar del toggle Sí/No se muestra `<CartaGarantiaBadge>` que lee el estado real (`vigente` / `por_vencer` / `vencida` / `sin_carta`) desde la vista `costeo_tarifas_vigentes_v` usando `calcularEstadoCartaGarantia()` de `src/features/costeo/types/navieraCondicion.ts`.
- En Paso 2 (`SeccionCostosInternosPLLocal`) se eliminó el botón "Buscar tarifa Costeo". Si hay `tarifaId`, el componente precarga automáticamente flete + recargos al montar (solo si la lista de costos está vacía) y muestra banner "Costos precargados desde tarifa X".
- Servicios: `fetchTarifaVinculada(id)` consulta la vista `costeo_tarifas_vigentes_v`. Hook: `useTarifaVinculada(id)` con react-query (staleTime 60s).
- Warnings no bloqueantes en el panel: tarifa vence antes de `validezPropuesta`; tipo de contenedor del Paso 1 difiere del de la tarifa.

Aplica sólo a `modo = Marítimo`. Aéreo/Terrestre conservan el flujo manual.
