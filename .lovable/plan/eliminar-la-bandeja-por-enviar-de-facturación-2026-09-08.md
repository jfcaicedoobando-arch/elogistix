# Eliminar la bandeja "Por enviar" de Facturación

## Contexto
El usuario confirma que el listado "Por enviar" no es necesario: no todas las facturas se envían por correo; algunos clientes descargan su CFDI y revisan su estado de cuenta directamente en el portal. La bandeja hoy lista CFDI timbrados sin envío por correo registrado, lo que genera ruido (badge amarillo permanente) sin acción real.

## Qué se quita
El tab "Por enviar" del cockpit de Facturación (grupo "Preparar"), su badge de conteo y toda la plomería que sólo existe para alimentarlo.

## Qué NO se quita
- La acción **Enviar CFDI por correo** desde el detalle de la factura (`DialogEnviarCfdi`, usado también en `ContactosClienteList` y `FacturaNotasCreditoSeccion`): quien sí envía por correo podrá seguir haciéndolo factura por factura.
- La tabla `factura_envios` y su historial de envíos.
- El resto de bandejas (Por timbrar, Por cobrar, Vencidas, etc.) y sus conteos.
- URLs viejas: `?bandeja=por-enviar` caerá en el default existente ("Por timbrar"), sin redirect nuevo.

## Cambios
1. **Borrar** `src/features/facturacion/components/bandejas/BandejaPorEnviar.tsx` (167 líneas).
2. `FacturacionBandejasTabs.tsx`: quitar import y `<TabsContent value="por-enviar">`.
3. `BandejaTabs.tsx`: quitar `"por-enviar"` del tipo `BandejaId`, del arreglo `DEFS` y del mapa `counts`.
4. `Facturacion.tsx`: quitar `"por-enviar"` de `BANDEJAS_VALIDAS` y actualizar el comentario de encabezado (8 bandejas → 7).
5. `hooks/useBandejas.ts`: quitar `useFacturasPorEnviar` y el re-export de `FilaPorEnviar`.
6. `services/bandejas.ts`: quitar re-export de `fetchFacturasPorEnviar`/`FilaPorEnviar`.
7. `services/bandejasQueries.ts`: quitar `fetchFacturasPorEnviar`, `FilaPorEnviar`, `MAX_TIMBRADAS_PAGINADAS` y —al quedar sin consumidores— `fetchIdsConEnvioExitoso`, `fetchIdsFacturasTimbradas` y `ESTADOS_TIMBRADAS_ENVIABLES`.
8. `services/bandejasConteos.ts`: quitar el conteo `porEnviar` del tipo y del cálculo (ya no hay badge que lo use); esto además elimina 2 queries paginadas que se disparaban en cada visita al módulo.
9. `queryKeys.ts`: quitar la key `bandejaPorEnviar`.
10. `invalidarTrasTimbrado.ts`: ajustar comentario (la invalidación por prefijo se mantiene para las bandejas restantes).
11. **Tests**: borrar `bandejasPorEnviar.test.ts` y `bandejasPorEnviarPaginacion.test.ts`; ajustar cualquier test de conteos/tabs que espere `porEnviar` (verificación con rg antes de cerrar).
12. Bump patch a **13.823.232** (o el siguiente disponible si HEAD avanzó) + entrada breve en `CHANGELOG.md`.

## Verificación (local, focalizada)
- `rg` residual de `por-enviar|porEnviar|PorEnviar` en `src` debe quedar vacío (salvo comentario histórico si aplica).
- Typecheck + ESLint de archivos tocados + build.
- Sin migraciones, sin cambios de datos, sin publicar. CI/RLS/suites globales quedan para GitHub Actions.
