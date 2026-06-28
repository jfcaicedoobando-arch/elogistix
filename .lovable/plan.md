# Pendientes tras v13.140.0

## 1. Lote 6 del plan de cohesión visual (no ejecutado)

**a) Densidad en Tesorería / Comisiones**
Extraer un wrapper `<DenseCard>` (o variante `density="dense"` en `Card`) que aplique `CardContent` con `p-3 / p-4` de forma legítima, y migrar:
- `src/features/tesoreria/routes/Tesoreria.tsx`
- `src/features/tesoreria/routes/TesoreriaFlujo.tsx`
- `src/features/tesoreria/routes/TesoreriaConciliacion.tsx`
- `src/features/comisiones/routes/Comisiones.tsx`

Hoy estas rutas tienen overrides sueltos de padding que se reemplazaron en otros lotes pero aquí siguen vivos.

**b) Documentar patrón de toasts (Q3)**
Actualizar JSDoc del shim `src/hooks/shared/useToast.ts` para deprecar explícitamente el "prefer sonner directo" y dejar `useToast` + `crmToast` como única vía. No requiere migrar archivos (no hay imports directos de `sonner` en features hoy, ya validado).

**c) Documentar patrón `p-0` en `CardContent` con tablas full-bleed (Q2)**
Añadir nota en JSDoc de `src/components/ui/card.tsx` explicando que `p-0` es aceptable cuando el hijo es una tabla `full-bleed` (patrón usado en facturación, embarques, cxp).

## 2. Memoria de diseño

- Crear `mem://style/card-tokens` si formalizamos `DenseCard`, listando: cuándo usarlo, qué padding aplica, y prohibición de `shadow-*`/`border-*` overrides en `<Card>` normal.
- Actualizar `mem://style/form-dialog-shell` con los 4 modales migrados en Lote 1 (`DialogCancelarFactura`, `DialogMarcarFacturada`, `PanelConciliacionMovimiento`, y nota de que `FilaContenedor` se quedó como `AlertDialog` por ser confirmación pura).

## 3. Verificación end-to-end pendiente del lote v13.140.0

Aunque los cambios pasaron lint/tests unitarios, falta:
- Screenshots Playwright 1920×1080 de las rutas tocadas para confirmar que no hay regresiones visuales: `/operaciones`, `/reportes`, `/login`, `/portal/perfil`, `/proveedores/{id}`, `/clientes/{id}`, detalle de embarque (tabs Facturación con `DialogCancelarFactura` y `DialogMarcarFacturada`), tesorería (panel de conciliación).

## 4. Backlog heredado (no del UI kit)

- **Auditoría Operativa Fase 4**: emails recordatorios + escalación de hallazgos no resueltos (planeada, no implementada).
- **AUDIT-17.1** (`.lovable/audit-todos.md`): reactivar `send-transactional-email` con template `cotizacion-respuesta` para notificar al operador cuando un cliente responde desde el portal. Bloqueado por configurar dominio de email + registrar template en `registry.ts`.

---

## Resumen para programador principiante

Como cuando terminas de pintar la casa pero te queda un cuarto sin pintar, un par de notas que pegar en la pared y verificar con una linterna que ningún rincón quedó manchado:
- **Cuarto sin pintar**: tesorería/comisiones (Lote 6).
- **Notas en la pared**: documentar en código y memoria los patrones que ya usamos.
- **Linterna**: screenshots Playwright para confirmar que el resto quedó bien.
- **Pendientes ajenos**: dos tareas viejas que no son del repintado pero siguen abiertas (Fase 4 de Auditoría y AUDIT-17.1).

¿Atacamos el Lote 6 (Tesorería/Comisiones), las verificaciones Playwright, o el backlog heredado?
