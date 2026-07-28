## Wave 15 — Bug bash live (siguiente lote)

Objetivo: bajar los pendientes de 17 a ~10 aplicando los diffs listos del MD `instrucciones-lovable-bugs-e2e-2026-07-28-2.md`. Se agrupan por capa para minimizar riesgo (SQL primero, luego frontend puro).

### Bugs a corregir

**Capa SQL/BD (una migración)**
- **B-032** · `seed_demo_organization()` sin datos CxP: sembrar facturas de proveedor + pagos CxP en la org Demo para que las pantallas de Compras/CxP no estén en ceros. Idempotente por org demo fija.

**Capa Frontend (diffs del MD, sin cambios de negocio nuevos)**
- **B-030** · Bandeja de pagos programados: hoy usa `cxp_por_pagar` que filtra `estado='Vigente'` en silencio → tesorero ve "2 de N". Nuevo `fetchPagosProgramables()` lee `proveedor_facturas` directo (no canceladas, saldo > 0), agrega sección "Sin fecha de pago" y filtro explícito (Todas / Solo programadas / Vencen en 30 días) con default "todas".
- **B-049** · Copy: "Pendiente revisión" → "Pendiente cliente" en las demás vistas donde aún aparece (unificar con B-048).
- **B-052** · Toasts del wizard de cotización acumulados en pares: `useCreateCotizacion`/`useUpdateCotizacion`/`useUpsertCotizacionCostos` reciben opción `silent` y el wizard la activa; los puntos finales del wizard notifican una sola vez.
- **B-054** · Drag kanban CRM sobrescribe probabilidad manual con el default de etapa: al mover una tarjeta, sólo actualizar `probabilidad` si el usuario NO la ha personalizado (o si viene de una etapa `perdida/ganada`).
- **B-056** · Póliza de seguro: validaciones silenciosas — el submit se queda muerto sin toast. Añadir `handleSubmit` con `onInvalid` que muestre los errores Zod agregados.
- **B-061** · Validaciones Zod silenciosas en diálogos de anticipos (mismo patrón que B-056): `onInvalid` con toast que resume los campos con error.

### Fuera de este lote (por complejidad o dependencia)
- B-034 (CRM oportunidad ganada sin fecha_cierre_real): requiere revisar RPC + UI, se hará en Wave 16.
- B-029 (import CSV validación por fila): cambia contrato del parser + tests; se propone aislado en Wave 16.
- B-044 (subir realmente los 11 docs del cliente): condicional a verificación en staging.
- B-012, B-021, B-059: decisiones de diseño / diagnóstico previos.

### Detalles técnicos

Archivos a tocar (sin re-leer el MD durante la implementación, ya está en contexto):

- Nuevo: `src/features/tesoreria/services/pagosProgramados.ts`
- `src/features/tesoreria/routes/TesoreriaPagosProgramados.tsx`
- `src/features/cotizacion/hooks/mutations/useCotizacionMutations.ts`
- `src/features/cotizacion/hooks/useCotizacionCostos.ts`
- `src/features/cotizacion/routes/NuevaCotizacion.tsx`, `EditarCotizacion.tsx`
- `src/features/crm/**` (localizar handler de drag kanban antes de tocarlo)
- `src/features/seguros/**` (localizar form de póliza)
- `src/features/anticipos/**` (localizar diálogos)
- Migración Supabase: extender `seed_demo_organization()` con facturas + pagos CxP (idempotente por `organization_id = de100000-…-0001`).

Cierre de wave:
- Bump `APP_VERSION` a `13.320.51`.
- Entrada `CHANGELOG.md` con explicaciones cortas + analogías (regla del proyecto).
- Reporte de sprint: 46 → ~52/63 cerrados; pendientes ~11.

### Verificación mínima por bug
- **B-030**: con facturas en captura/Borrador y con `fecha_programada_pago`, aparecen en la bandeja; las sin fecha caen en "Sin fecha de pago".
- **B-032**: `SELECT count(*) FROM proveedor_facturas WHERE organization_id = 'de100000-…-0001'` > 0 tras re-seed.
- **B-049**: badge de proforma dice "Pendiente cliente" en todas las vistas.
- **B-052**: guardar wizard = un solo toast; error de paso = un solo toast con contexto.
- **B-054**: mover una tarjeta con `probabilidad` custom mantiene el valor; una tarjeta sin custom toma el default de la etapa nueva.
- **B-056 / B-061**: submit inválido dispara toast con lista de campos, en lugar de "no pasa nada".
