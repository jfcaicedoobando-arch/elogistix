# Ajuste regla `docs_faltantes` para embarques En Tránsito

## Problema
El embarque 290 aparece con hallazgo **crítico "documentos faltantes"** porque la matriz canónica exige BL Master + BL House desde el estado **En Tránsito**. En la práctica, las navieras suelen liberar esos documentos días después del zarpe, así que estamos generando falsas alarmas para un caso completamente normal del negocio.

## Objetivo
Que la auditoría **no marque hallazgo** por BL / AWB / Carta Porte cuando el embarque todavía está En Tránsito. Esos documentos seguirán exigiéndose a partir de **En Aduana** en adelante (que es cuando realmente los necesitamos para despacho).

## Cambios

### 1. Base de datos — matriz canónica
Nueva migración que reemplaza `public._docs_requeridos_por_estado(modo, estado)`. Sólo cambia la rama `WHEN 'En Tránsito'`:

| Modo | Antes (En Tránsito) | Después (En Tránsito) |
|---|---|---|
| Marítimo / Multimodal | Factura Comercial, Packing List, **BL Master, BL House** | Factura Comercial, Packing List |
| Aéreo | Factura Comercial, Packing List, **AWB** | Factura Comercial, Packing List |
| Terrestre | Factura, Lista de Empaque, **Carta Porte** | Factura, Lista de Empaque |

Los estados **En Aduana, Llegada, Arribo, En Proceso, Entregado, EIR, Cerrado** se quedan idénticos: siguen exigiendo BL/AWB/Carta Porte como hoy.

Al ser la fuente única, este cambio impacta automáticamente:
- `auditoria_embarques_org` (regla `docs_faltantes`).
- `embarque_docs_faltantes` (candado al avanzar estado — En Tránsito es soft-warn, no bloqueante, así que no rompe nada).

### 2. Memoria del proyecto
Actualizar `.lovable/memories/features/auditoria-docs-faltantes-rules.md` y `candado-docs-avance-estado.md` con la nueva matriz.

### 3. Changelog + versión
- Bump `APP_VERSION` → `13.299.17`.
- Entrada en `CHANGELOG.md` explicando el cambio de regla.

## Notas técnicas
- **No** se toca `getDocsForMode` (UI del wizard): el usuario debe poder seguir adjuntando BL/AWB/Carta Porte cuando quiera desde En Tránsito; sólo dejamos de **exigirlos** a nivel auditoría.
- **No** se cambia la severidad `critico` de `docs_faltantes` en estados posteriores — sigue siendo crítico si llegamos a En Aduana sin BL.
- Analogía: es como pedirle a alguien la factura de un Uber apenas se sube al carro — la factura llega al final del viaje, no al arranque. Movemos la exigencia al momento en que el documento realmente existe.
