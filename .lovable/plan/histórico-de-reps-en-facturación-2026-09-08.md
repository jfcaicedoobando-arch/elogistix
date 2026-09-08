# Histórico de REPs en Facturación

## Qué quiere el equipo
En Facturación, dentro del grupo **Histórico** (hoy: Emitidas y Notas de crédito), agregar una bandeja **REPs** para consultar los complementos de pago ya timbrados, con descarga de PDF/XML.

## Estado actual (verificado)
- Los REPs timbrados viven en `pagos_factura` (estado_rep = 'Timbrado'). Hoy hay **53 REPs timbrados** en la base.
- Cada pago con REP guarda: `serie_rep`, `folio_rep`, `uuid_rep`, `timbrado_rep_en`, `rep_pdf_url`, `rep_xml_url`, `rep_cancellation_status` (para saber si fue cancelado después).
- Ya existe el servicio de descarga `fetchCfdiFacturapi({ tipo, pagoId })` (proxy a FacturApi) usado en el detalle de factura — se reutiliza, no se crea nada nuevo.
- La bandeja "REP pendientes" (grupo Cobrar) ya lista pagos Pendiente/Error; esta nueva bandeja es su espejo histórico (Timbrados).
- No se necesita migración: la tabla y permisos ya existen; la consulta es de sólo lectura con el mismo patrón de las demás bandejas.

## Cambios
1. **`services/bandejasQueries.ts`** — nueva `fetchRepsHistorico(orgId)`: pagos con `estado_rep = 'Timbrado'`, `deleted_at is null`, ordenados por `timbrado_rep_en` desc, con join a factura (número, cliente). Mismo límite `CAP_LISTA` que las demás bandejas. Campos: folio REP (serie+folio), factura, cliente, fecha pago, monto/moneda, fecha de timbrado, estado de cancelación.
2. **`hooks/useBandejas.ts` + `queryKeys`** — hook `useRepsHistorico()` (staleTime 60 s, igual que los demás).
3. **Nuevo `components/bandejas/BandejaRepsHistorico.tsx`** — tabla con `BandejaShell` + `ResponsiveDataTable` (mismo patrón que las otras bandejas): buscador por factura/cliente, orden por fecha, paginación cliente, tarjeta móvil. Acciones por renglón: **PDF** y **XML** (iconos de descarga usando `fetchCfdiFacturapi` con `pagoId`). Badge "Cancelado" si `rep_cancellation_status` indica cancelación aceptada. Clic en fila → detalle de la factura (igual que REP pendientes).
4. **`BandejaTabs.tsx`** — nueva entrada `{ id: "reps", label: "REPs", group: "historico" }` sin badge de conteo (igual que Emitidas/Notas: se excluye del mapa de conteos).
5. **`FacturacionBandejasTabs.tsx`** — nuevo `TabsContent value="reps"` que monta la bandeja. La bandeja se sincroniza con la URL (`?bandeja=reps`) por el mecanismo ya existente.
6. **`CHANGELOG.md` + bump `APP_VERSION`** y manifiesto al final, según el flujo habitual.

## Sin alcance (YAGNI)
- No se crean rutas, RPCs, migraciones ni tablas nuevas.
- No se cambian las bandejas existentes ni la lógica de timbrado/cancelación.
- No se agrega envío por correo desde el histórico (sólo consulta y descarga).

## Validación
- Typecheck + ESLint focalizados en archivos tocados; build.
- Revisión visual manual en Facturación → Histórico → REPs con datos existentes (53 REPs), verificando descarga PDF/XML.
- Suites completas CI/RLS/Vitest/E2E quedan para GitHub Actions (política del proyecto). No se publica.

## Detalles técnicos
- Reutiliza: `BandejaShell`, `ResponsiveDataTable`, `useClientPagedList`, column builders, `fetchCfdiFacturapi`.
- La descarga respeta la sesión actual (el proxy usa el token del usuario).
