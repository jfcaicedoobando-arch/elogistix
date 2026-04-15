

## v8.10.0 — Notas por concepto de venta en cotizaciones

### Concepto

Agregar un campo de texto "Notas" opcional en cada fila de concepto de venta (USD y MXN). Las notas se almacenan dentro del JSON `conceptos_venta` existente en la tabla `cotizaciones` — no requiere migración de base de datos. Las notas aparecerán debajo de cada concepto en el PDF exportado.

### Plan de acción

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useCotizacionTypes.ts` | Agregar `notas?: string` a `ConceptoVentaCotizacion` |
| 2 | `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx` | Agregar input de notas debajo de cada fila de concepto (USD y MXN) — un textarea compacto con placeholder "Notas (opcional)" |
| 3 | `src/hooks/useConceptosVentaCotizacion.ts` | Incluir `notas: ""` en el template de concepto nuevo |
| 4 | `src/components/cotizacion/TablaConceptosGenerico.tsx` | Mostrar notas (si existen) como texto gris debajo de la descripción en la vista detalle |
| 5 | `src/lib/cotizacionPdf.ts` | Renderizar notas debajo de cada fila de concepto en el PDF (texto italic gris) |
| 6 | `src/data/changelogData.ts` | Entrada v8.10.0 |

### Diseño visual

**En el wizard:** Debajo de cada fila de concepto, un textarea de 1 línea que se expande al hacer focus, con texto `text-xs text-muted-foreground`.

**En el PDF:** Debajo de cada fila del concepto, una línea en itálica gris con la nota:
```text
| Flete Marítimo | BL | 1 | $1,200.00 | $1,200.00 |
|   ↳ Incluye seguro básico                         |
```

### Sin migración SQL

El campo `notas` vive dentro del JSONB `conceptos_venta` que ya se almacena en la tabla `cotizaciones`. No se necesita alterar ninguna tabla.

