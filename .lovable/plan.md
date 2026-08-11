# Badge de "Buzón de facturas" en el sidebar

Mostrar junto a **Compras → Buzón de facturas** un badge con el número de documentos pendientes por capturar, igual que ya se hace en "Por aprobar" y "Por pagar".

## Comportamiento

- El badge cuenta los documentos del buzón con estado `por_capturar` (los mismos que ve el usuario en la pestaña activa de `/compras/buzon`), sin incluir documentos eliminados.
- Si el conteo es 0, no se muestra badge (misma regla que el resto de los items).
- Tooltip: "N documento(s) por capturar en el buzón".
- Con el sidebar colapsado el badge se oculta, como los demás.
- El número se actualiza solo: se refresca cuando se sube, captura, rechaza, retira o reactiva un documento del buzón (esas mutaciones ya invalidan el buzón completo), y cada minuto como red de seguridad si otro usuario captura algo.

## Detalle técnico

1. `src/features/cxp/services/facturasEntrantesCount.ts` (nuevo): `fetchEntrantesPorCapturarCount()` — consulta `embarque_facturas_entrantes` con `select("id", { count: "exact", head: true })`, `estado = por_capturar` y `deleted_at is null`. Devuelve `count ?? 0`.
2. `src/features/cxp/queryKeys.ts`: agregar `facturasEntrantesPorCapturarCount: ["cxp", "facturas-entrantes", "por-capturar-count"]`. Al colgar de `facturas-entrantes`, la invalidación existente (`useInvalidarEntrantes`) ya lo cubre sin tocar las mutaciones.
3. `src/features/cxp/hooks/useEntrantesPorCapturarCount.ts` (nuevo): `useQuery` con `staleTime: 60_000`, siguiendo el patrón de `useCxpPorPagarCount`.
4. `src/hooks/layout/useAppSidebarSections.ts`: consumir el hook, agregar `buzonPorCapturar` a `BadgeCounts` y aplicar el badge al item con `url === "/compras/buzon"` con su `badgeHint`.
5. Pruebas: una unitaria del servicio de conteo (filtros correctos y `count` nulo → 0) y un caso en las pruebas del sidebar que verifique que el item del buzón recibe `badgeCount`.
6. Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION` a `13.502.0`.

No hay cambios de base de datos: la tabla ya tiene RLS por organización, así que el conteo queda limitado a la org activa.
