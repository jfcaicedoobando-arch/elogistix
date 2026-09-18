# Auditoría IVA — lote P2 (seis hallazgos)

Objetivo: que cada renglón diga su tratamiento de IVA (16%, 8%, 0%, Exento, No objeto o "Por confirmar") en la captura, en pantalla, en el portal del cliente y en los PDF. Sin cambiar ningún importe ni regla fiscal ya resuelta.

## 1. Cotización: candado del 8% al elegir producto del catálogo
- `ProductoServicioSelect.tsx`: usar `useIvaFronteraHabilitada`. Los productos con tratamiento 8% quedan deshabilitados en la lista, con la explicación estándar `AVISO_IVA_FRONTERA_DESHABILITADO` y `onSelect` ignorado (misma semántica que `FacturaTipoIvaSelect`).
- `ConceptoDescripcionSelector.tsx`: no cambia la copia de datos; el bloqueo queda arriba, así que un producto al 8% ya no puede entrar a un renglón nuevo.
- Las líneas ya guardadas al 8% se conservan intactas (el candado sólo gobierna selecciones nuevas).
- Regresión: `ProductoServicioSelect.frontera.test.tsx` (estímulo apagado → opción 8% deshabilitada y sin `onSelect`; encendido → selecciona normal).

## 2. Resumen de conceptos del embarque (MXN y USD)
- Nuevo componente compartido chico `TratamientoIvaBadge` (en `features/embarques/components/facturacion/`) que rinde `etiquetaTratamientoFila`.
- `ResumenConceptosVenta.tsx` y `GrupoConceptosContenedor.tsx`: reemplazar el badge `+IVA` condicionado a USD por la etiqueta efectiva por línea, en las dos monedas. No se deriva el tipo del booleano `aplica_iva`.
- Regresión: prueba de la etiqueta por fila para 16/8/0/exento/no objeto/legacy en MXN y USD.

## 3. Tarjetas de totales del embarque
- `ResumenConceptosVentaTotales.tsx`: el subtítulo pasa a "Total" y sólo dice "IVA incluido" cuando el bloque realmente trae IVA. Se recibe un indicador booleano por bloque calculado en el padre a partir de la etiqueta/tasa efectiva de sus conceptos; la aritmética de `sumarConceptosVentaPorMoneda` no se toca.
- Regresión: todo exento/no objeto → "Total" sin afirmar IVA; con 16% → "IVA incluido".

## 4. Portal público de proforma
- Migración (`CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token`): agregar al JSON de cada concepto `tipo_iva`, `tasa_iva_aplicada` y `aplica_iva` (columnas ya existentes en `proforma_conceptos_consolidados`). Sin cambios en encabezado, totales, rate limit ni en las ramas de token expirado/respondido (siguen devolviendo `conceptos: []`).
- Espejo `supabase/schema/portal/portal_obtener_proforma_por_token.sql` + `db:baseline:update` + `audit:manifest`.
- `portalPublico.ts`: `PortalProformaConcepto` gana los tres campos opcionales.
- `PortalProformaResumen.tsx`: columna "IVA" con la etiqueta del tratamiento ("Por confirmar" cuando los datos heredados no alcanzan).
- Regresión: prueba de render de la tabla del portal con los cinco tratamientos y un renglón legacy.

## 5. PDF de proforma
- `proformaConceptosColumns.ts`: nueva columna "Trat. IVA" por línea con `etiquetaTratamientoFila`, presente también cuando el grupo no tiene IVA efectivo (para distinguir exento de no objeto). Columnas de IVA/Total y totales sin cambios.
- Regresión: snapshot de columnas/etiquetas por tratamiento.

## 6. PDF de cotización
- `cotizacionColumnas.tsx`: quitar el sufijo "(+IVA N%)" de la descripción USD y usar una columna fiscal por renglón idéntica en USD y MXN (misma etiqueta compartida). Totales y `armarBloques` sin cambios.
- Regresión: mezcla de tasas en MXN muestra la etiqueta por línea; USD igual.

## Notas técnicas
- Fuente única de etiquetas: `etiquetaTratamientoFila` + `TIPO_IVA_LABEL_CORTO`; nada nuevo se infiere de `aplica_iva`.
- Sin cambios en cálculo de importes, IVA ni totales en ninguno de los seis puntos.
- Archivos ≤200 líneas; se extraen subcomponentes si algún archivo crece.
- Validaciones locales focalizadas: `bunx tsgo --noEmit -p tsconfig.app.json`, `bunx eslint` de los archivos tocados, las seis pruebas nuevas y, por la migración, `bun run db:postcheck`. CI completo, RLS y E2E quedan a GitHub Actions. Sin publicar ni tocar producción.
