# Auditoría de permisos — todos los roles

Comparé `roleCatalog.ts` (descripciones), `usePermissions.ts` (matriz lógica), `sidebarRoleBuilders.ts` (menú) y `appRoutes.tsx` (guards de ruta) para los 13 roles activos + 3 legacy.

## Resultado por rol

| Rol | Sidebar coherente con rutas | Notas |
|---|---|---|
| super_admin | ✓ | Usa `buildDefaultSections` + Admin + Super Admin |
| admin / admin_org | ✓ | `buildAdmin`, todas las rutas alcanzables |
| gerente_operaciones | ✓ | Corregido en 13.114.3 |
| gerente_comercial | ✓ | Corregido en 13.114.3 |
| gerente_visor | ✓ | Sin builder dedicado → cae a default (full lectura). Ya está en todos los guards de lectura financiera |
| coordinador_logistico | ✓ | Gestión, Costeo, Directorio — todo sin guard o permitido |
| ejecutivo_pricing | ✓ | Gestión, Costeo, Reportes — todo accesible |
| contador | ✓ | En todos los guards que necesita (CXP, Tesorería, Facturación, Cartera, Profit) |
| **tesorero** | **❌** | Sidebar muestra **Cobranza (`/cartera`)** pero la ruta no lo permite — clic redirige a `/` |
| auxiliar_contable | ✓ | Compras + Sistema |
| ejecutivo_cobranza | ✓ | Cartera, Facturación, Clientes |
| vendedor | ✓ | CRM + Clientes + Ayuda |
| customer_service | ✓ | Dashboards, Gestión limitada, Clientes, Auditoría |
| cliente | ✓ | Redirigido a `/portal`, fuera del flujo |
| Legacy (admin/operador/viewer) | ✓ | `admin`→buildAdmin, `operador`→buildCoordinador, `viewer`→buildCustomerService |

## Hallazgos accionables

### 1. Bug confirmado — Tesorero no puede abrir Cobranza

`buildTesorero` lista "Cobranza" (`/cartera`) pero el guard actual es `["admin","super_admin","admin_org","contador","ejecutivo_cobranza","gerente_operaciones","gerente_visor"]` — sin `tesorero`. Tiene sentido funcional darle **lectura** porque concilia depósitos bancarios con cobros (descripción: "conciliación bancaria y liquidación de comisiones").

**Fix:** agregar `tesorero` a `allowedRoles` de `/cartera` en `appRoutes.tsx` y al test `appRoutes.smoke.test.tsx`.

### 2. Rutas sin guard (decisión, no bug)

Estas rutas no tienen `ProtectedRoute` con roles → cualquier usuario autenticado las abre escribiendo la URL, aunque el sidebar las oculte para algunos roles:

- `/comisiones` — Vendedor podría entrar (no aparece en su sidebar)
- `/bitacora`, `/sentry` — Cualquier rol entra escribiendo URL
- `/reportes/*` — Cualquier rol entra
- `/profit/proyeccion`, `/profit/estado-resultados` — Cualquier rol entra
- `/clientes`, `/proveedores`, `/cotizaciones`, `/embarques`, `/facturacion`, `/proformas`, `/operaciones` — Roles "cliente" y casos extremos están protegidos por `ProtectedRoute` raíz; el resto entra

**No es estrictamente un bug** porque la RLS de la BD limita los datos que se ven, pero sí es una superficie de UX inconsistente. Hay dos caminos:

- **(A) Mínimo (recomendado para esta tarea):** solo corregir el bug del tesorero. Mantener las rutas abiertas como están.
- **(B) Endurecer:** agregar guards de ruta a `/comisiones` (excluir vendedor/customer_service), `/bitacora` (solo admin/contador/tesorero/gerentes), `/sentry` (solo admin/super_admin), `/profit/proyeccion` y `/profit/estado-resultados` (mismos roles que `/profit/dashboard`).

## Plan propuesto (opción A)

1. Editar `src/routes/appRoutes.tsx`: sumar `"tesorero"` al `allowedRoles` de `/cartera`.
2. Actualizar el caso correspondiente en `src/routes/__tests__/appRoutes.smoke.test.tsx`.
3. Bump `APP_VERSION` a `13.114.4` y agregar entrada en `CHANGELOG.md` (analogía: "el tesorero veía el botón de Cobranza pero estaba pintado en una puerta cerrada — ahora la puerta abre en modo lectura").
4. Ejecutar `bunx vitest run src/routes/__tests__/appRoutes.smoke.test.tsx src/hooks/layout/__tests__/useLayout.test.tsx`.

## Pregunta para ti

¿Voy con la **opción A** (solo arreglar el bug del tesorero, mínimo invasivo) o quieres también la **opción B** (endurecer las rutas hoy abiertas)? Si eliges B, dime si la lista de roles que propongo arriba te parece bien o quieres ajustarla.
