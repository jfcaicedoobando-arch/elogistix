## Contexto

De la ronda 2 (`lovable_fixes_elogistix_v2.md`) ya quedaron cerrados **Q-01, Q-02, Q-05** (v13.339.0) y **Q-14** (integrity-guard, v13.334.5). Quedan pendientes de revisar/corregir **Q-03, Q-04** (críticos) y **Q-06 a Q-13, Q-15, Q-16, Q-17**.

Antes de tocar código, cada ítem se verifica contra el estado actual (algunos pudieron quedar cubiertos de paso en versiones posteriores); lo que ya esté resuelto se marca como tal en el CHANGELOG sin re-trabajarlo.

---

## Ola 1 — Críticos restantes

**Q-03 · Tarifas que no matchean el wizard ni el Top 3**
- Diagnosticar duplicados reales en `puertos` (por LOCODE) y `tipos_contenedor` (por código) con consultas a la base.
- Si hay duplicados: migración de consolidación (re-apuntar referencias al registro canónico, luego desactivar el duplicado; nunca borrar en cascada).
- Cambiar el matching de `get_top_tarifas` y de "tarifas sugeridas" para resolver por **código** (locode / código de contenedor) en vez de por id de fila.
- Quitar el estado contradictorio banner-de-error + empty-state simultáneos: uno u otro, con "Reintentar" cuando sea error.

**Q-04 · Segregación de funciones (SoD)**
- Verificación explícita de rol dentro de las RPC `SECURITY DEFINER` de CxP: captura (`admin/super_admin/contador`), aprobación (aprobador ≠ capturista), pago (`tesorero/admin`), con error `LC_SOD_VIOLATION`.
- Cotizaciones: "Aceptar" solo con estado `Enviada` y total > 0; "Enviar" solo con `Borrador` y total > 0; registrar `aceptada_por` y bloquear auto-aceptación salvo admin.
- UI: **ocultar** (no solo deshabilitar) acciones que el rol no puede ejecutar.

---

## Ola 2 — Dinero y datos correctos

- **Q-06** Tesorería: convertir cada cuenta a la moneda de presentación con el TC vigente (ya existe la tabla `tipos_cambio_dof` y el hook de TC); mostrar TC y fecha usados; si no hay TC, **no sumar** — desglosar por moneda con advertencia. Aplica también a entradas/salidas proyectadas del flujo.
- **Q-15.1** Off-by-one de semanas en el flujo proyectado (ISO vs local en `date_trunc('week')`).
- **Q-15.2** Ejecutar pago programado contra cuenta bancaria (descontar saldo + marcar factura).
- **Q-15.9** Totales erráticos al capturar Cant/Costo/Venta en costos de cotización (parseo/binding, doble multiplicación).
- **Q-15.6** Alinear criterio del KPI "Por pagar 30d" con el widget "Top 10 próximas".

---

## Ola 3 — Estabilidad de formularios y errores

- **Q-07** Inputs que se resetean (IVA se va a 0 al teclear retenciones; buscador de proveedores pierde texto): un solo *source of truth* por campo, keys estables.
- **Q-08** Ciclo de vida del banner global: por-ruta (se limpia al navegar), acción primaria "Reintentar" in situ (nunca navegar), detalles en popover, y sin empty-state falso mientras hay error.
- **Q-09** Completar retry real: `timeoutMs` + `onRetry` en `/tesoreria/flujo`, detalle de factura CxC y CxP, y auditar que toda pantalla con query pase `error` y `onRetry`.
- **Q-15.3** Sanitizar errores crudos de Postgres en toasts → mensajes de negocio.
- **Q-15.4** Refetch en "Por timbrar" tras guardar borrador CxC.
- **Q-15.8** "Nueva cuenta bancaria" debe abrir vacía, no prellenada.

---

## Ola 4 — Bloqueos de catálogo y navegación

- **Q-10** Opción "Concepto libre" + CTA "Crear concepto" inline en costos del wizard.
- **Q-11** Matriz rol→ruta como fuente única de la que deriven menú y guards; eliminar enlaces muertos de dashboards; toast "No tienes acceso a esa sección" en vez de redirect silencioso.
- **Q-12** Autosave del wizard: persistir y restaurar `pasoActual` y las filas de costos; avisar explícitamente lo que no se pudo restaurar.
- **Q-13** Alta/edición de navieras en UI, empty-state accionable en el select y corregir el desmontaje del modal.
- **Q-15.5** Truncado del nombre de proveedor en la tabla del directorio.
- **Q-15.7** Captura manual de movimientos en conciliación bancaria.

---

## Ola 5 — Pulido y prevención

- **Q-16** Los 10 puntos de pulido UX (pluralización, error de login duplicado, offset de toasts, CTAs en empty-states, título por ruta, saludo con nombre, dimensiones LCL en FCL, confirmación de exportar PDF, grupo "Sistema" vacío, flash del portal).
- **Q-17** `scripts/e2e/seed-demo.ts`: 3 navieras, 2 agentes, 2 rutas, 3 tarifas vigentes, 8 productos, 2 cuentas bancarias (MXN+USD con TC), 1 cliente y 1 proveedor, idempotente y alineado con el provisioning que ya existe en `scripts/e2e/`.

---

## Tests (obligatorio por ola, no al final)

- **Unitarios**: conversión multi-divisa de tesorería (con y sin TC), cálculo de semana ISO, parseo de importes de costos, matriz rol→ruta, matching de tarifas por código.
- **Componente**: regresión de Q-07 (subtotal → IVA → retenciones conserva los tres), banner por-ruta que se limpia al navegar, "Aceptar cotización" oculto para borradores en $0.
- **Integración**: query que falla → a ≤15s aparece error con "Reintentar" funcional (cubre Q-09).
- **Base de datos**: rechazo `LC_SOD_VIOLATION` por rol en las RPC de CxP.
- Se respeta el umbral de coverage existente: se escriben tests del código nuevo, nunca se baja el umbral.

## Notas técnicas

- Cada ola cierra con `CHANGELOG.md` + bump de `APP_VERSION`, en español mexicano y con analogía breve.
- Las migraciones nuevas pasan por `audit:migrations` (incluida la regla H8) e `integrity-guard.sql` antes de darse por buenas.
- Se usan subagentes en paralelo para las olas 2 a 5, que tocan módulos independientes.

## Sugerencia de entrega

Propongo ejecutar **Ola 1 + Ola 2** en el primer turno (es lo que bloquea release y lo que corrompe cifras de dinero) y seguir con las demás; si prefieres otro orden o cerrar todo de un tirón, dímelo antes de aprobar.
