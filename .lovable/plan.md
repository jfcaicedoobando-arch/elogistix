## P7 · Bandeja Facturación con paginación server-side (cierra Ola 1)

Cambio la bandeja de "Facturas emitidas" para que traiga máximo 100 filas por página desde el servidor en vez de descargar 5,000 y paginar en el navegador. Réplica del patrón que ya usa Embarques.

### Analogía
Hoy la bandeja pide "mándame todo el archivero" y luego enseña 100 hojas por vez. Con el cambio pedirá solo la gaveta que se va a leer.

### Cambios

**1. Nuevo hook paginado (`src/features/facturacion/hooks/useFacturas.ts`)**
- Añadir `useFacturasListado({ page, pageSize, search, estado, fechaDesde, fechaHasta })` que llama `fetchFacturasListado` y devuelve `{ rows, count, isLoading }`.
- Query key vía `queryKeys.facturacion.listado(filtros)` (nuevo).
- `keepPreviousData: true` para paginar sin flicker.

**2. Query keys (`src/features/facturacion/queryKeys.ts`)**
- Añadir `facturas.listado(filtros)` — no romper claves existentes.

**3. Controller (`useFacturacionPageController.ts`)**
- Reemplazar `useFacturas` por `useFacturasListado` en el tab `facturas`.
- Mover `search`/`estado`/`cliente`/fechas al fetch server (search y estado ya los acepta el RPC; cliente y `isInRange` siguen como filtro client sobre las 100 filas si es necesario — en la práctica el filtro de cliente ya viene implícito por el search).
- `paginatedFacturas` = `rows` directamente; `totalPages = Math.ceil(count / pageSize)`.
- Debounce del search (300ms) para no disparar refetch por tecla — usar `useDebounce` de `@/hooks/shared`.
- `clientesDisponibles`: dejar de derivar del listado paginado (solo tendría 100 clientes). Alternativa: mantener el filtro de cliente pero deshabilitado en este tab, o alimentarlo con una query aparte ligera. **Decisión propuesta**: mantener derivación desde la página actual y añadir nota; si más tarde se necesita catálogo completo, lo resolvemos en un ítem separado.
- Exports CSV/layout: seguir usando el listado paginado actual (exportar solo la página). Marcar como TODO para exportar totales — fuera del alcance de P7.

**4. Tests**
- Reescribir `facturasCrud.test.ts:56` "fetchFacturas pasa pageSize=5000" por uno que verifique que el nuevo hook pasa `page`/`pageSize` reales al RPC.
- Añadir test del controller: al cambiar `page`, se dispara nueva query con el offset correcto.
- Ajustar `useFacturacionPageController.test.tsx` si depende del shape antiguo.

**5. Versionado**
- `APP_VERSION` → `13.317.3`.
- CHANGELOG bullet en root.

### Riesgos y mitigaciones
- **Filtro por cliente**: hoy filtra client-side sobre 5,000 filas. Con paginación server, filtrar por cliente sobre 100 filas visibles puede vaciar la página. Mitigación: si el usuario elige cliente, mandarlo al `p_search` del RPC (busca por `cliente_nombre` en SQL). Verificar en `facturas_listado` que el `p_search` cubre nombre de cliente; si no, añadir cliente como filtro en el RPC en migración corta.
- **Export CSV**: solo exportará la página. Documentar limitación y proponer export completo separado si el usuario lo pide.

### Aceptación
- La bandeja de facturas trae 100 filas máximo por request (verificar en DevTools Network).
- Paginar/buscar/filtrar estado dispara un fetch nuevo con el offset correcto.
- `totalPages` cuadra con `count` del RPC.
- Tests verdes, lint 0.
