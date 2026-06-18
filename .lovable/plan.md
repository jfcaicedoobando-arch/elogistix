## Situación actual

El detalle de un embarque tiene **13 tabs** en orden poco lógico:

`Resumen · Documentos · Costos · Conciliación · P&L · P&L Contenedor · Facturación · Garantías · Demoras · Seguros · Cierre · Tracking · Notas y Actividad`

Problemas:
- Tracking aparece al final, cuando es operación diaria.
- P&L y P&L Contenedor son la misma vista con distinta agrupación.
- Garantías y Demoras son el mismo concepto (free time de contenedor → cargo extra).
- Conciliación está separada de Facturación pese a ser CxP del mismo flujo.
- No hay agrupación por etapa (operación / finanzas / cierre).

## Propuesta: fusiones

| # | Fusión | Justificación |
|---|---|---|
| 1 | **P&L** + **P&L Contenedor** → una sola tab `P&L` con toggle interno *Global / Por contenedor* | Mismos datos, distinta agrupación. Ya hoy son dos componentes hermanos. |
| 2 | **Garantías** + **Demoras** → una sola tab `Garantías y Demoras` con dos secciones colapsables | Ambos derivan del timeline + tabulador naviera; el usuario los consulta juntos al cerrar costos. |
| 3 | **Conciliación** se mueve dentro de la familia financiera (no se fusiona con Facturación porque una es CxP-proveedor y la otra CxC-cliente, pero quedan contiguas) | Mantener separación contable, mejorar adyacencia. |
| 4 | **Notas y Actividad** se mantiene como tab propia (es bitácora cross-feature, no solo tracking) | No fusionar con Tracking: Tracking = eventos operativos, Notas = comentarios + auditoría. |

Resultado: **13 → 11 tabs**.

## Nuevo orden propuesto

Agrupado por flujo operativo (izquierda = día a día, derecha = cierre):

```text
[ Operación ]              [ Finanzas ]                          [ Cierre ]      [ Bitácora ]
Resumen  Tracking  Documentos | Costos  Garantías y Demoras  Seguros  P&L  Facturación  Conciliación | Cierre | Notas y Actividad
```

Razonamiento del orden:
1. **Resumen** — entrada por defecto.
2. **Tracking** — lo más consultado durante la operación; sube desde el penúltimo lugar al segundo.
3. **Documentos** — soporte operativo (BL, factura comercial, packing).
4. **Costos** — captura de conceptos venta/costo.
5. **Garantías y Demoras** — derivados de costos + timeline.
6. **Seguros** — accesorio de la carga, antes de calcular margen.
7. **P&L** — resultado consolidado (con toggle Global/Contenedor).
8. **Facturación** — emisión CxC al cliente.
9. **Conciliación** — CxP contra proveedores.
10. **Cierre** — checklist final.
11. **Notas y Actividad** — bitácora siempre al final.

## Alcance técnico

Solo UI/presentación, sin cambios de negocio:

- `src/features/embarques/components/EmbarqueDetalleTabs.tsx`
  - Reordenar `TabsTrigger` y `TabsContent` según el nuevo orden.
  - Renombrar `value="pnl-contenedor"` → eliminado; `TabPnl` recibe el toggle Global/Contenedor.
  - Renombrar `value="demoras"` → eliminado; `TabGarantias` recibe sección Demoras.
- `src/features/embarques/components/TabPnl.tsx` — añadir toggle (`ToggleGroup` shadcn) con dos vistas; reutiliza `TabPnlContenedor` como sub-componente. Estado local, sin URL params nuevos.
- `src/features/embarques/components/TabGarantias.tsx` — wrap actual + `<Separator/>` + render de `TabDemoras` debajo, con headings claros.
- Revisar deep-links existentes a `?tab=pnl-contenedor` y `?tab=demoras` si los hay → redirigir a `pnl` y `garantias` respectivamente (compatibilidad).
- Actualizar `CHANGELOG.md` y bump `APP_VERSION` (13.66.15).
- Tests: smoke test del componente `EmbarqueDetalleTabs` (orden y existencia de las 11 tabs); ajustar tests que referencien las tabs eliminadas.

## Fuera de alcance

- No tocar lógica de cálculo de P&L, garantías ni demoras.
- No mover lógica de negocio entre archivos.
- No cambiar permisos ni RLS.
- No tocar el wizard de creación.

## Riesgos

- Usuarios acostumbrados al orden actual: mitigado por agrupación lógica + changelog visible.
- Deep-links rotos: mitigado con redirección de `tab` query param.
