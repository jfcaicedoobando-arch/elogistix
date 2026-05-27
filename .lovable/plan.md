
# Plan: cierre ordenado del backlog de auditoría

## Pendientes y dependencias

| ID | Tarea | Esfuerzo | Riesgo | Depende de |
|----|-------|----------|--------|------------|
| ~~D14~~ | ✅ 11.63.0 — Guardrail oversized>200 activo en `architecture-baseline.test.ts` | XS | Nulo | — |
| ~~C10~~ | ✅ 11.63.0 — Quick wins (4 estáticos migrados) + política documentada en `mem://principles/inline-styles`. 30 restantes son excepciones legítimas (react-pdf, virtualizer, %-dinámico, colores DB). | M | Bajo | — |
| D16 | Reducir 37 casts HIGH (`as any`, `as unknown as`) | L | Medio (runtime) | D14 ✅ |
| D12 | Dividir `routes.tsx` (188 líneas) en `routes/{admin,portal,crm,public}.tsx` | S | Bajo | D14 ✅ |
| D13 | Vigilar archivos 180-200 líneas (preventivo) | XS continuo | Nulo | D14 ✅ |
| P1.5 | Unificar `utils/` + `lib/utils.ts` + `lib/utils/` | M | Medio (imports masivos) | D16 |
| P1.6 | Romper servicios "god" (facturas/proyeccion, cotizacion/mutations, huecoFacturacion) | L | Alto (lógica financiera) | D16, P1.5 |
| P1.7 | Schemas Zod en boundary Supabase (embarques/facturas/cotizaciones) | L | Medio | P1.6 |
| Cx  | Bajar complejidad 13 funciones src/ + 4 edge functions a ≤12 | M | Medio | P1.6 |

## Orden óptimo y justificación

```text
Fase 1 — Blindaje (sin riesgo)
  1. D14  guardrail test                            ← evita regresiones desde día 0
  2. C10  inline styles → tokens                    ← UI-only, no toca lógica

Fase 2 — Limpieza tipos y rutas
  3. D16  casts HIGH (en tandas de ~10)             ← destapa bugs ocultos antes de refactors grandes
  4. D12  split routes.tsx                          ← rápido, mejora DX para Fase 3

Fase 3 — Reorganización estructural
  5. P1.5 unificar utils/                           ← prerequisito real para romper servicios
  6. D13  pasada preventiva 180-200 líneas          ← aprovecha el momentum

Fase 4 — Refactors de dominio (alto riesgo, requieren tests verdes)
  7. P1.6 romper servicios god                      ← necesita tipos limpios (D16) y utils unificados (P1.5)
  8. P1.7 Zod en boundary Supabase                  ← se inserta natural al partir los servicios
  9. Cx   reducir complejidad ≤12 + activar guardrail

```

### Por qué este orden

- **D14 primero**: 5 minutos, cero riesgo, congela el avance ganado. Si algo crece >200 líneas en pasos posteriores, CI lo frena.
- **C10 antes que refactors**: es puramente visual, no interfiere con tipos ni servicios, y deja el CSS coherente antes de mover archivos.
- **D16 antes que P1.5/P1.6**: los `as any` ocultan contratos rotos; arreglarlos primero hace que mover utils y partir servicios revele errores reales del compilador, no falsos verdes.
- **D12 después de D14**: el guardrail activo garantiza que el split de rutas no reintroduzca un archivo gigante; además mejora la navegación para los refactors siguientes.
- **P1.5 antes de P1.6**: romper servicios "god" implica mover helpers; tener `lib/utils/` + `lib/io/` ya unificado evita doble trabajo de imports.
- **P1.7 acoplado a P1.6**: insertar Zod en el mismo momento que partes el servicio es 1 PR en vez de 2, y aprovecha que ya estás tocando los boundaries.
- **Complejidad al final**: muchas de las 13 funciones bajarán de complejidad "gratis" al partir los servicios god (P1.6) y unificar utils (P1.5). Atacarlas antes sería trabajo perdido.

## Entregables por fase

- **Fase 1** → ✅ 11.63.0 (D14 + C10 combinados)
- **Fase 2** → 11.64.x (D16 por tandas) + 11.65.0 (D12)
- **Fase 3** → 11.66.0 (P1.5) + nota D13
- **Fase 4** → 11.67.0 (P1.6 + P1.7 acoplado) + 11.68.0 (complejidad + guardrail ≤12)

## Fuera de alcance de este plan

- Implementación detallada de cada bloque (se planificará al iniciar cada fase).
- Cambios funcionales o de UI no listados en la auditoría.

## Próximo paso

**Fase 2 — D16**: primera tanda de ~10 casts HIGH (priorizar archivos con mayor cantidad de `as any`).
