# Captura desde el buzón: modo asistido para contabilidad

## Qué pasa hoy

Cuando contabilidad abre "Capturar factura de proveedor" desde el buzón, el modal es el **mismo** que la captura manual: le pide elegir origen del documento, le muestra la zona de "Sube el XML/PDF" (aunque el archivo ya viene del buzón), y no aprovecha lo que el operador ya declaró. Verificado en el código:

- `DialogNuevaFacturaProveedor.columnas.tsx` siempre pinta `OrigenDocumentoPicker` y `CargaCfdiSection`, incluso con `entrante` presente.
- `EntranteParaCaptura` (en `types/entranteCaptura.ts`) **no lleva** el `proveedor_id` ni el `monto_declarado` que ya capturó operaciones; el contador vuelve a elegir proveedor a mano.
- Los conceptos sugeridos ya se pre-marcan (v13.506.0), pero **sin decírselo**: aparecen palomeados sin explicación de quién los eligió.

Es como recibir un sobre ya rotulado y volver a preguntar "¿de quién es y qué trae?".

## Cambio 1 — Modo buzón: se esconde lo que ya está resuelto

Cuando la captura viene del buzón:

- Desaparecen el selector de origen y la zona de carga de archivos (el documento ya existe).
- En su lugar, una tarjeta **"Documento del buzón"** con: nombre del archivo, expediente (enlace al embarque), botones "Ver PDF" / "Ver XML", quién lo subió y cuándo, y el estado de la lectura automática.
- Las partidas del CFDI siguen apareciendo abajo, igual que hoy.

Resultado: el modal arranca en "verifica y guarda", no en "sube algo".

## Cambio 2 — Lo que dijo operaciones viaja hasta la factura

Se hereda del documento del buzón:

- **Proveedor**: se prellena el proveedor que marcó operaciones. Si el RFC del CFDI apunta a otro proveedor, se avisa en ámbar y se deja elegir (nunca se sobrescribe una elección manual del contador).
- **Monto declarado**: chip comparativo "Operaciones declaró 1,200 USD · CFDI 1,200 USD ✓" o en ámbar con la diferencia cuando no cuadra.
- **Nota para contabilidad**: se precarga en el campo de notas si el contador no escribió nada.
- **Conceptos sugeridos**: banda explícita "Operaciones sugirió 3 conceptos de costo · ya vienen marcados", con acciones "Quitar todos" y "Volver a aplicar". Los conceptos que ya tienen otra factura viva aparecen listados como descartados y por qué.
- Si operaciones marcó "sin costo capturado", se muestra el aviso y la sección de vinculación arranca vacía con la explicación.

## Cambio 3 — Orden y ritmo del modal en modo buzón

```text
[Encabezado: totales]            (igual que hoy)
1. Documento del buzón           (archivo + expediente + lectura)
2. Avisos                        (CFDI duplicado, proveedor/RFC, monto vs declarado)
3. Datos de la factura           (proveedor prellenado, folio, fechas, importes)
4. Partidas del CFDI
5. Vinculación al embarque       (conceptos sugeridos ya marcados)
[Barra fija: semáforo de cuadre] (igual que hoy)
```

En captura manual el modal queda **exactamente como hoy**: el modo asistido sólo aplica cuando hay documento del buzón.

## Cambio 4 — Cerrar con confianza

- El botón de guardar muestra en su hint qué falta (ya existe `PendientesGuardarHint`); se le suman los avisos nuevos: "el monto no coincide con lo declarado" y "no hay conceptos vinculados" — como advertencias, sin bloquear.
- Al guardar, la bitácora del documento registra que la factura nació del buzón con los conceptos sugeridos aceptados o rechazados, para poder auditar después.

## Detalles técnicos

- `EntranteParaCaptura` gana `proveedorId`, `proveedorNombre`, `montoDeclarado`, `monedaDeclarada`, `notaOperaciones`, `sinCostoCapturado`, `subidoPor`, `creadoEn`; `aEntranteParaCaptura` en `useCapturaDesdeBuzon.ts` los mapea desde `FacturaEntranteRow` (todas las columnas ya vienen en `SELECT_COLS_ENTRANTES`).
- Nuevo `useHerenciaEntrante.ts` (hook, ≤200 líneas): prellena proveedor y nota una sola vez por documento, sin pisar ediciones del contador.
- `DialogNuevaFacturaProveedor.columnas.tsx`: `BandaOrigenYAlertas` y `ColumnaDocumento` reciben `modoBuzon: boolean`; oculta `OrigenDocumentoPicker` y `CargaCfdiSection` cuando es `true`.
- Componentes nuevos, cada uno chico: `DocumentoBuzonCard.tsx` (archivo + enlaces + estado de lectura, reemplaza al banner actual en modo buzón), `AvisoMontoDeclarado.tsx`, `SugerenciasOperacionesBanda.tsx`.
- `usePrefillVinculosEntrante` devuelve además `aplicados` y `descartados` para alimentar la banda de sugerencias y permitir "quitar todos / volver a aplicar".
- Descarga/visualización de archivos reutiliza `descargarArchivoEntranteComoFile` y el visor existente del buzón; sin nuevas RPC ni migraciones.
- Sin colores hardcodeados: tokens `info`, `warning`, `success`, `muted`.
- Tests: mapeo de `aEntranteParaCaptura` con los campos nuevos, `useHerenciaEntrante` (prellena y no pisa), comparador monto declarado vs CFDI, y render del modal en modo buzón (sin zona de carga ni selector de origen).
- `CHANGELOG.md` + `APP_VERSION` → 13.507.0.
