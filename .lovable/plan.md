
## Objetivo

Sacar 9 embarques del sistema anterior del listado "Embarques sin factura" en `/facturacion`, sin crear CFDIs falsos ni proformas sintéticas. Se agrega una marca reversible por embarque.

## Embarques a marcar (confirmados en la base)

| Expediente   | Cliente                              | ETA         |
| ------------ | ------------------------------------ | ----------- |
| ELIMP00003   | INDIMEX TRADING                      | 2026-04-06  |
| ELIMP00058   | INDIMEX TRADING                      | 2026-04-15  |
| ELIMP00140   | INDIMEX TRADING                      | 2026-05-02  |
| ELIMP00141   | INDIMEX TRADING                      | 2026-04-26  |
| ELIMP00143   | INDIMEX TRADING                      | 2026-05-01  |
| ELIMP00146   | INDIMEX TRADING                      | 2026-05-02  |
| ELIMP00150   | INDIMEX TRADING                      | 2026-05-01  |
| ELIMP00150   | INDIMEX TRADING                      | 2026-05-01  |
| ELEXP00250   | COMERCIALIZADORA VISTRAIN-GONZALEZ   | 2026-05-25  |

(hay dos filas con expediente `ELIMP00150` — ambas se marcan)

## Cambios

### 1. Migración: nueva columna en `embarques`

- Agregar `facturado_historico BOOLEAN NOT NULL DEFAULT false` a `public.embarques`.
- Índice parcial `WHERE facturado_historico = true` para consultas rápidas.
- **Analogía:** es como una "estampa de archivado" que le pones a un expediente viejo para que la bandeja de pendientes lo ignore, pero el expediente sigue completo.

### 2. Data patch: prender el flag en los 9 embarques

Un `UPDATE embarques SET facturado_historico = true WHERE id IN (...)` con los 9 IDs listados arriba.

### 3. Excluir del "hueco de facturación"

Archivo: `src/features/facturacion/services/huecoFacturacion/fetchSources.ts`
- En `fetchEmbarquesParaHueco`, agregar `.or("facturado_historico.is.null,facturado_historico.eq.false")` (o `.eq("facturado_historico", false)`) al query.
- Sin cambios en la UI ni en la lógica de cobertura por proformas.

### 4. Versionado y bitácora

- `APP_VERSION` → `13.213.50`.
- Entrada en `CHANGELOG.md` describiendo la marca de facturación histórica y los 9 expedientes afectados.

## Verificación

1. Correr el `bunx vitest run` relevante (`huecoFacturacion` si existe test) — no debe romper.
2. Abrir `/facturacion` → tab "Embarques sin factura": los 9 expedientes ya no aparecen.
3. El resto de embarques del listado sigue igual.

## Reversibilidad

Si algún expediente se marcó por error, un simple `UPDATE embarques SET facturado_historico = false WHERE expediente = '...'` lo devuelve al listado. No se pierde información.
