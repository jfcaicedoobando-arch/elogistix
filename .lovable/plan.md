## Problema

En el PDF de proforma (`ProformaDocument.tsx`), las columnas inline de cada concepto se muestran como:

```
Descripción | Cant. | P. Unit. | Total | IVA
```

El orden es contraintuitivo: la columna "Total" aparece antes de "IVA", cuando lógicamente el IVA debería calcularse antes y el Total al final (importe + IVA = total de línea).

## Cambio propuesto

Reordenar las columnas en `columnasUSD` (y revisar `columnasMXN`) a:

```
Descripción | Cant. | P. Unit. | Importe | IVA | Total
```

Donde:
- **Importe** = `cantidad × precio_unitario` (lo que hoy se llama "Total")
- **IVA** = monto de IVA de la línea (o "—" si no aplica)
- **Total** = Importe + IVA (nueva columna, total real de línea)

Esto deja claro al cliente cómo se forma el total de cada renglón y respeta el orden de lectura natural.

### Aplica a:
- `src/pdf/documents/ProformaDocument.tsx` (`columnasUSD`, `columnasMXN`)
- Revisar `ProformaConsolidadaDocument.tsx` si tiene el mismo orden (probablemente sí) y aplicar el mismo arreglo
- Actualizar los snapshots/tests en `src/pdf/documents/__tests__/ProformaDocument.test.tsx` y `ProformaConsolidadaDocument.test.tsx` si validan headers/orden

### MXN
Hoy MXN no muestra columna de IVA inline (siempre aplica 16% y se ve sólo en `TotalesBox`). Para consistencia, agregar también columnas `Importe | IVA | Total` en MXN, ya que el IVA siempre aplica.

### Metadata
- Bump `APP_VERSION` a `12.94.3`
- Entrada en `CHANGELOG.md`: "PDF Proforma: reordenar columnas a Importe → IVA → Total para mayor claridad."

## Pregunta

¿Confirmas que quieres la columna nueva **Total = Importe + IVA** por línea, o prefieres sólo **reordenar** (mover IVA antes de Total, manteniendo "Total" como cantidad × precio sin IVA)?
