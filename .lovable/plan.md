## Problema

El widget "Sin tracking reciente" (Mi Operación) incluye embarques con estado `Arribo`. Un embarque ya arribado no necesita actualizar ETA, por lo que aparece como "26D de retraso" injustificadamente (caso ELIMP00223).

## Causa

En `src/features/embarques/services/dashboardOperador.ts`, la función `fetchSinTrackingOperador` filtra por:

```ts
.in("estado", ["En Tránsito", "Arribo", "En Aduana"])
```

`Arribo` significa que el buque ya llegó al puerto destino — el tracking de ETA deja de ser relevante. `En Aduana` es una etapa posterior, también post-arribo.

## Cambio propuesto

**Un solo archivo:** `src/features/embarques/services/dashboardOperador.ts`

- Quitar `"Arribo"` del filtro `.in("estado", ...)` en `fetchSinTrackingOperador`.
- Evaluar también quitar `"En Aduana"` (ya arribó, la operación relevante es despacho aduanal, no tracking marítimo). **Recomendado: dejar sólo `["En Tránsito"]`.**
- Actualizar el comentario de reglas de negocio del archivo.

## Versionado y bitácora

- `src/constants/appVersion.ts` → `13.214.4`.
- `CHANGELOG.md` → entrada `[13.214.4]` describiendo la exclusión de embarques ya arribados del widget.

## Pregunta abierta

¿Confirmas que el widget sólo debe listar embarques en `**En Tránsito**`? (Si prefieres mantener `En Aduana`, lo dejo también.) Solo en Transito 