## Contexto

De las 331 proformas de Elogistix, **285 aparecen como `estado_proforma='facturada'` pero `estado_aprobacion='borrador'**` — huella del ERP anterior. Al desagregarlas encontré 3 subgrupos muy distintos, y no se pueden tratar todos igual.

## Lo que descubrí al abrir el grupo


| Subgrupo                                                             | Filas | Qué significa                                                                |
| -------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| **A. Facturada real dentro del sistema** (`factura_id` presente)     | 120   | Están genuinamente facturadas, solo les falta cerrar el flujo de aprobación. |
| **B. Facturada por ERP anterior** (`folio_factura_externa` presente) | 11    | Legítimas, facturadas fuera del sistema.                                     |
| **C. "Facturadas fantasma"** (sin `factura_id` ni folio externo)     | 154   | Dicen "facturada" pero **no hay evidencia** — inconsistencia del ERP viejo.  |


Además hay **43 proformas en `pendiente/borrador**` que **no toco** (son captura legítima en curso).

## Propuesta de backfill en 2 pasos

### Paso 1 — Normalizar las 131 proformas con evidencia real (A + B)

Copiar `estado_revision` → `estado_aprobacion` solo cuando hay `factura_id` o `folio_factura_externa`:

```text
estado_revision = 'consolidada' → estado_aprobacion = 'consolidada'
estado_revision = 'aprobada'    → estado_aprobacion = 'aprobada'
estado_revision = 'pendiente'   → NO se toca (no tiene sentido aprobar sin revisar)
```

Impacto estimado: ~131 filas migradas de `borrador` al estado de revisión que ya tenían.

### Paso 2 — Decidir qué hacer con las 154 "facturadas fantasma"

Aquí necesito tu decisión. Tres opciones:

**Opción 1 — Revertir a `pendiente**` (más limpio)
Regresar `estado_proforma` a `pendiente`. Aparecerán en la bandeja de "por facturar" y el equipo decide si de verdad debieron facturarse o si eran basura del ERP viejo. Reversible.

**Opción 2 — Marcar como legado archivado**
Agregar un flag `origen='legacy_erp'` (nueva columna) y mantenerlas como facturadas sin factura. No estorban a operación pero quedan visibles en reportes históricos.

**Opción 3 — Solo aprobarlas y dejarlas como están**
Copiar `estado_revision → estado_aprobacion` igual que en Paso 1, aceptando que "facturada sin factura" es la realidad heredada. La opción más rápida pero conserva la inconsistencia.

## Sección técnica

- Todo corre en una transacción con respaldo previo a `_backup_backfill_proformas_20260706` (copia completa de las 285 filas antes de tocar).
- Se usa el mismo enfoque que la fusión de clientes: `BEGIN/COMMIT` con verificación al final (`DO $$ ... RAISE EXCEPTION ... $$`).
- No requiere migración de esquema salvo que elijas **Opción 2** (agrega columna `origen` a `proformas`).
- Los 5 casos "facturada + revision=pendiente + sin factura" caen naturalmente en el subgrupo C y siguen la misma decisión que las 154.
- No se tocan las 3 proformas ya en `facturada/aprobada` ni las 43 en `pendiente/borrador`.

## Lo que necesito de ti

1. **¿Confirmas el Paso 1?** (backfill de las 131 con evidencia — bajo riesgo, reversible). Las proformas que tienen evidencia se marcan como ya facturadas. 
2. **¿Qué opción tomamos para el Paso 2** (las 154 fantasma)? Vamos con la opcion 2 y se marcan como facturadas. 