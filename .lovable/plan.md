## Dónde estamos

Verifiqué en el código los 17 hallazgos del documento (`lovable_fixes_elogistix_v2.md`). La mayoría ya está resuelta en olas anteriores; lo que queda son bordes concretos, no módulos completos.

**Cerrado y con evidencia (11 de 17)**
- Q-01 Solicitudes del portal: enum `Solicitada`, política del cliente y RPC ya lo crean así.
- Q-02 Conceptos manuales en factura de proveedor + cuadre 0.01 + mensaje real del servidor sin redirigir.
- Q-05 Alta de usuarios: re-verificación de membresía, 409 por correo duplicado, rol exacto, organización obligatoria.
- Q-06 Divisas en Tesorería con conversión y tipo de cambio DOF visible.
- Q-07 IVA/Retenciones ya no se borran (hay prueba de regresión "Q-07 repro").
- Q-09 Tiempo de espera + "Reintentar" en flujo de tesorería y detalles de factura.
- Q-10 Concepto libre en cotización y en captura de compras.
- Q-11 Matriz rol→ruta única para menú y guardias, con aviso al bloquear.
- Q-12 Autoguardado del wizard restaura paso y costos.
- Q-17 Semilla de demo (`scripts/e2e/seed-demo.ts`) completa.
- Q-16 pulido: pluralización, títulos por pantalla, toasts bajo el header, grupos vacíos ocultos, LCL sólo cuando aplica.

**Pendiente real (6) y por confirmar (2)**

| # | Falta |
|---|---|
| Q-01b | La bandeja de ventas no distingue "Solicitud de portal" (llega como una cotización más) |
| Q-03 | El Top 3 y las tarifas sugeridas siguen cruzando por identificador de fila, no por código de puerto/contenedor; el catálogo de puertos no tiene regla que impida duplicados |
| Q-04b | Falta confirmar/blindar que quien creó una cotización no pueda aceptarla él mismo, y que los botones prohibidos se oculten en vez de sólo deshabilitarse |
| Q-05b | La tabla de usuarios no muestra si la invitación está pendiente o el usuario ya está activo |
| Q-08 | El aviso global de error: su acción principal debe ser "Reintentar" (hoy convive con "Ir al inicio") y debe limpiarse al cambiar de pantalla |
| Q-13b | Si no hay navieras, el selector del modal "Nueva tarifa" queda mudo: falta "No hay navieras — Crear naviera" |
| Q-14b | La verificación de integridad de base sólo corre en el paso de publicación, no en cada cambio |
| Q-15b | Cuatro puntos del lote medio sin evidencia: refresco de "Por timbrar" al guardar, nombre de proveedor truncado en el directorio, error de login duplicado, y parpadeo "Bienvenido/CL" en el portal |

## Qué haré

**Fase 1 — Cerrar los 8 pendientes** (en este orden)
1. Q-03 (el de mayor impacto de negocio): unicidad de puertos por LOCODE y de contenedores por código; resolución por código antes de llamar al Top 3, para que una tarifa vigente siempre aparezca.
2. Q-04b y Q-05b: bloqueo de auto-aceptación en base de datos + columna de estado de invitación.
3. Q-08 y Q-13b: aviso de error por pantalla con "Reintentar", y selector de naviera con salida accionable.
4. Q-01b, Q-14b y los 4 puntos de Q-15b.

**Fase 2 — Pruebas para toda la app**
- Unitarias/integración nuevas para cada arreglo de la Fase 1 (regresión permanente).
- Pruebas faltantes detectadas: resumen de tesorería, RPC de solicitud del portal, buscador de proveedores.
- E2E: 3 recorridos nuevos sobre la semilla de demo — solicitud desde el portal hasta aceptación, catálogo vacío → crear naviera → tarifa → aparece en Top 3, y alta de usuario con estado de invitación.
- Subir el umbral de cobertura del 38% actual al nivel que arroje la corrida real, para que no vuelva a bajar.

**Fase 3 — Cierre**
- Corrida completa: pruebas, auditorías de arquitectura/migraciones, integridad de base y E2E contra la semilla.
- `CHANGELOG.md` + `APP_VERSION` a `13.345.0`.

## Detalles técnicos

- **Q-03**: migración con `CREATE UNIQUE INDEX` sobre `puertos(locode)` y `tipos_contenedor(codigo)` previa consolidación de duplicados (reasignando FKs en `costeo_tarifas`, `cotizaciones`, `embarques`); `get_top_tarifas` gana sobrecarga que acepta códigos y resuelve internamente; `resolverCatalogos.ts` deja de ser fuzzy-text.
- **Q-04b**: `CHECK`/validación en la RPC de aceptación (`aceptada_por <> creada_por` salvo `admin`), y auditoría del JSX que consume `accionesCotizacionPermitidas` para render condicional.
- **Q-05b**: derivar estado desde `auth.users.last_sign_in_at`/`email_confirmed_at` vía la edge function `user-management` (no exponer la tabla) y pintarlo en `usuariosColumns.tsx`.
- **Q-08**: hook de error ligado a `useLocation` que resetea al navegar; `ErrorBoundaryFallback` con "Reintentar" primario y detalles en popover.
- **Q-14b**: agregar el paso `audit:db-integrity` a `ci.yml` (hoy sólo en `deploy-gate.yml`) verificando que el fallo aborte.
- E2E: nuevos specs en `e2e/specs/` reutilizando los Page Objects existentes y `seed-demo.ts`; se suman al sharding del workflow `e2e.yml`.
