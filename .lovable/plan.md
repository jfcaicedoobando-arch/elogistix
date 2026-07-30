## Objetivo

1. Eliminar el tab "Facturas proveedor" del detalle del embarque y llevar su contenido dentro del tab **Costos** (los costos y sus facturas viven juntos).
2. Ligar el buzón de facturas de proveedor al **checklist de cierre**: no se podrá cerrar el embarque si hay invoices pendientes por capturar o si hay costos sin evidencia (archivo) en el buzón.

## Cómo quedará el tab Costos

```text
Costos
├── KPIs (Venta · Costo · Utilidad · Margen)
├── Conceptos de costo (tabla actual + reconciliación)
└── ── separador ──
    Facturas de proveedor recibidas  (buzón CxP)
    · Badges: por capturar / capturadas / rechazadas
    · Botón "Subir factura" (operación)
    · Lista de archivos con abrir / eliminar
```

- El tab "Facturas proveedor" desaparece de la barra (quedan 11 tabs, la barra respira mejor).
- Las URLs viejas `?tab=facturas-entrantes` seguirán funcionando: se redirigen a `?tab=costos&focus=facturas-entrantes`, y esa sección se resalta al entrar.
- Se conserva la segregación de funciones: operación sólo sube archivos, contabilidad captura la factura desde el Buzón CxP del módulo de Compras.

## Checklist de cierre

Se agregan dos reglas nuevas a la validación de cierre (ambas bloquean el cierre):

| Regla | Qué valida | Responsable | Acción |
|---|---|---|---|
| Invoices del buzón capturados | Ningún archivo queda en estado "Por capturar" | Auxiliar contable | Ir a Costos |
| Evidencia de factura recibida | Cada proveedor con costos en el embarque tiene al menos un archivo subido al buzón | Operador | Ir a Costos |

Cada regla muestra el conteo de pendientes y un botón que lleva directo a la sección de facturas dentro de Costos.

## Detalles técnicos

**Base de datos (migración)**
- Ampliar `public.validar_cierre_embarque` con los checks `facturas_entrantes_pendientes` y `facturas_entrantes_evidencia`, leyendo `embarque_facturas_entrantes` (ignorando `deleted_at` y estados rechazados según corresponda). Se mantiene `SECURITY DEFINER` + `REVOKE/GRANT` explícito para no romper la auditoría H6.
- Índice de apoyo por `(embarque_id, estado)` si no existe.

**Frontend**
- `EmbarqueDetalleTabs.tsx`: quitar el trigger y el `TabsContent` de `facturas-entrantes`; renderizar `TabFacturasEntrantes` dentro del `TabsContent` de costos, tras un `Separator`.
- `EmbarqueDetalle.tsx`: alias de tab legacy (`facturas-entrantes` → `costos` + `focus`).
- `TabFacturasEntrantes.tsx`: soportar `focus` para hacer scroll/resalte; sin cambios de lógica.
- `cierreCheckMeta.ts`: metadatos (label en español, responsable, ruta `?tab=costos&focus=facturas-entrantes`, CTA) y formatters de detalle en `cierreCheckFormatters.ts`.

**Pruebas**
- Unit tests de los nuevos formatters y del mapeo de metadatos.
- Test de render del tab Costos verificando que la sección de facturas aparece.
- Test del alias de URL legacy.

**Cierre**
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
