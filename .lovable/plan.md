# Auditoría de código — Libre Carga (solo lectura)

Analicé 3,978 archivos en `src/` más las funciones del backend. Nada se modificó.

**Estado general: bueno.** Los guardrails ya instalados (Power of 10, tests de arquitectura, ESLint con `complexity` y `max-lines`) están funcionando: 0 componentes llaman a la base de datos directamente, 0 `@ts-ignore`, 0 archivos fuera del límite de líneas salvo uno, tests siempre en `__tests__/`, y `services/` es la única convención de acceso a datos. Los problemas que quedan son de **fronteras entre módulos**, no de desorden.

Analogía: la casa está limpia y ordenada por cuartos; el problema es que hay puertas abiertas de más entre cuartos y unas cajas guardadas en el cuarto equivocado.

---

## Pasos recomendados, de más crítico a opcional

### 1. CRÍTICO — Acoplamiento cruzado entre features (1,852 archivos)
Features de negocio importan las "tripas" de otros: `bandejas` → `cxp` (~20 archivos), `compras` → `cxp`, `cotizacion` → `costeo` (13 archivos), `costeo` → `catalogos` (6), `admin` → `configuracion` (6). Los más importados desde fuera: `embarques` (509 refs), `cxp` (483), `facturacion` (462), `cotizacion` (413).

Riesgo: cambiar algo interno de `cxp` rompe `bandejas` y `compras` sin aviso.

Acción: definir para cada feature una API pública (`index.ts` barrel) y prohibir por linter los imports profundos `@/features/X/components/...` entre features distintos. Mover a compartido lo que de verdad es compartido (catálogos, tipos de embarque, helpers de CFDI).

### 2. CRÍTICO — Tipos de la base de datos usados directamente en componentes de UI (16 archivos)
Ej. `src/features/facturacion/components/detalle/NotaCreditoCamposFiscales.tsx:13` deriva un tipo desde `Tables<"factura_notas_credito">`. Igual en `cxp` (`NotaCreditoFila`, `NotasCreditoSection`, `DialogNotaCreditoProveedor`…), `embarques/TabTracking.tsx`, `presupuesto/DialogCategoria.tsx`.

Riesgo: cualquier migración que renombre una columna rompe la pantalla.

Acción: declarar los tipos en `domain/`/`types.ts` del feature y que la UI importe de ahí.

### 3. ALTO — Duplicación de nombres = probable lógica repetida
- `estadoCuenta.ts` en 4 lugares (`facturacion/estadoCuenta/services`, `proveedor/services`, `tesoreria/domain`, `tesoreria/services`).
- `embarque.ts` en 4 (`cxp/types`, `embarques/domain`, `embarques/domain/mappers`, `embarques/types`).
- `OrgInfoCard.tsx` ×2 (`admin` y `configuracion`), `TabFacturacion.tsx` ×2 (`configuracion` y `embarques`).

Acción: diff de cada par; unificar cálculo de saldos y usar un solo tipo canónico de embarque.

### 4. ALTO — Reglas de negocio escondidas en `useEffect`
Caso testigo: `src/features/anticipos-proveedor/components/RegistrarAnticipoDialog.tsx` (145 líneas) mezcla fetch de catálogos, `useForm` de 10 campos, 3 efectos con política de negocio (sugerir T/C DOF `:79-89`, autoseleccionar cuenta bancaria por moneda `:93-102`) y conversión de moneda inline (`:135-140`).

Riesgo: lógica financiera no testeable y difícil de auditar.

Acción: extraer a un hook `useAnticipoFormDefaults` + funciones puras en `domain/`; el diálogo solo renderiza.

### 5. ALTO — Traslapes de responsabilidad admin / configuracion
Mismos componentes, mismos hooks, imports mutuos en 6 archivos. Decidir un dueño: `configuracion` = ajustes del tenant; `admin` = consola de plataforma; sin importarse entre sí.

### 6. MEDIO — `src/lib/domain` contiene dominio de features, no utilidades
`facturasEntrantes*.ts`, `proveedorEntrante.ts`, `cfdiXmlMeta.ts`, `uuidFiscal.ts`, `cotizacionDetalle.ts`, `versionadoCotizacion.ts`, `bitacoraDescripcion*.ts` los consumen 2-3 features específicos. Vivir en `lib` engaña sobre su alcance.

Acción: mover a un módulo compartido explícito (p. ej. `features/_shared/facturasEntrantes/`) o documentar por qué son cross-cutting.

### 7. MEDIO — Prop drilling severo (100+ componentes con >8 props)
Peores: `FacturacionBandejasTabs.tsx` (28 props), `TabFacturasEmitidas.tsx` (26), `CotizacionDetalleContenido.tsx` (25), `EmbarqueDetalleHeaderActions.tsx` (25), `HallazgosFiltros.tsx` (21).

Acción: agrupar en objetos (`filtros`, `resumen`, `acciones`) o contexto local por pantalla. Empezar por los 5 peores.

### 8. MEDIO — Dispersión de lecturas sin `select` base compartido
`.from("facturas")` en 27 servicios distintos, `.from("embarques")` 37, `.from("cotizaciones")` y `.from("crm_oportunidades")` 22 cada una, cada uno con su propio `select(...)`. Además 46-54 usos de `select('*')` fuera de tests.

Acción: definir constantes de columnas por entidad y reutilizarlas; eliminar `select('*')` en rutas con muchos registros.

### 9. MEDIO — Cálculos financieros de presentación inconsistentes
`% de cumplimiento de meta` calculado en 3 variantes distintas (`PipelineResumen.tsx:15`, `OportunidadCard.parts.tsx:46`, `CrmDashboard.tsx:67`); `Math.round(tasaIva*100)` en `ResumenTotalesCotizacion.tsx:28`; `formatCurrency(Math.round(n)).replace(...)` en `AuditoriaRiesgoFinancieroCard.tsx:23`.

Acción: helpers únicos en `lib/formatters` / `domain`.

### 10. BAJO — Casts amplios y marcador SAFE-CAST
154 `as unknown as` fuera de tests (`DataTable.tsx:91`, `anticiposProveedorService.ts:76,111,128,144`, `exportOrg.ts:59`) y 224 menciones de `SAFE-CAST` en 117 archivos. Los revisados están justificados, pero el volumen ya es deuda: conviene un burn-down con meta trimestral.

### 11. BAJO — Nomenclatura de carpetas
`domain/` (20 features) vs `utils/` (7) vs `lib/` (3), y cinco features tienen ambos sin criterio claro. Nombres mixtos: `dashboard` / `dashboardEjecutivo` frente a `anticipos-proveedor` / `portal-agente`.

Acción: fijar criterio en `docs/` y renombrar a kebab-case gradualmente.

### 12. OPCIONAL — Higiene menor
- `src/components/ui/sidebar.tsx` (602 líneas) es el único archivo fuera del límite; es de shadcn, se puede exceptuar formalmente.
- 53 usos de `key={index}` en listas: revisar los que estén en listas reordenables.
- 167 avisos de arquitectura en ESLint (imports cruzados, `queryKey` inline, `0.16` hardcodeado): tratarlos como backlog visible.
- `knip` no reporta código muerto, pero con `ignoreExportsUsedInFile: true` no es concluyente; correr una pasada estricta cuando haya tiempo.

---

## Nota técnica
No hubo cambios de código, configuración ni base de datos en esta auditoría. Si apruebas, propongo atacar en el primer sprint los puntos 1-4 (fronteras entre features, tipos de BD en UI, duplicados de `estadoCuenta`/`embarque`, y extracción de la lógica de `RegistrarAnticipoDialog`), cada uno con su test de arquitectura para que no reaparezcan.
