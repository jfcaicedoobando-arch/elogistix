
## Diagnóstico del workflow

Rastreando `estado_revision` en el código:

- Se **crea** en `pendiente` cuando operativo/ventas genera una proforma desde un embarque (`DialogGenerarProforma`).
- Se **aprueba/rechaza** dentro del embarque, en `HistorialProformas.tsx` (pestaña Facturación del embarque). Es un control **interno de ventas/operaciones** para revisar la proforma antes de enviarla al cliente.
- **Nunca** se toca desde el módulo Facturación.

El flujo real del contable es:

```text
Ventas revisa → cliente acepta → LISTAS PARA FACTURAR → contable timbra
                                        ↑ aquí entra facturación
```

## Conclusión

El KPI **"Proformas por revisar"** en el dashboard de Facturación está fuera de scope: mide trabajo de otro rol (ventas/operativo). Meterlo ahí:

- Confunde al contable con un número que no es su responsabilidad.
- Fue la causa del ruido de las 33 legacy que acabamos de depurar.

**Sí está deprecado** para el rol contable. Se quita del dashboard de Facturación.

## Analogía

Es como si en el tablero del cajero del banco apareciera "expedientes pendientes de aprobar por el analista de crédito". Interesante, pero no es su chamba y sólo estorba.

## Cambio propuesto

`src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`:

1. Quitar el bloque `<Kpi label="Proformas por revisar" .../>` (líneas ~90-95).
2. Quitar el hook `useProformasPendientes` y la variable `porRevisar` / `porRevisarTone` (líneas 15, 63, 70, 78).
3. Bajar el grid de 7 a 6 columnas en xl (`xl:grid-cols-7` → `xl:grid-cols-6`) y actualizar el comentario que dice "6 KPIs (Por revisar, Listas…)".

El KPI **"Listas para facturar"** se queda — ese sí es del contable.

No se toca:
- `useProformasPendientes` (lo siguen usando otras pantallas de embarques/ventas).
- La lógica de `estado_revision` en la base ni en `HistorialProformas`.

## Housekeeping

- `CHANGELOG.md`: entrada nueva.
- `src/constants/appVersion.ts`: bump patch a `13.213.44`.

## Archivos a tocar

- `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
- `CHANGELOG.md`
- `src/constants/appVersion.ts`
