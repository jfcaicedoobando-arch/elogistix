# Plan: Pasos 9 + 10 de la auditoría

Objetivo: cerrar la auditoría arquitectónica con cambios de bajo riesgo y alto valor. Saltar Paso 8 (renombre PascalCase) y el worker de `descargarZip` por baja relación beneficio/riesgo.

Tras cada paso: `bun run lint -- --max-warnings 0`, bump `APP_VERSION`, entrada en `CHANGELOG.md`.

---

## Paso 10A — Extraer `checks` de `DialogTimbrarFactura`

**Archivo nuevo:** `src/features/facturacion/utils/validarDatosTimbrado.ts`

Función pura:
```text
buildChecksTimbrado({ rfc, cp, regimen, usoCfdi, formaPago, metodoPago })
  → { checks: { ok: boolean; label: string }[], puedeTimbrar: boolean }
```

**Editar:** `DialogTimbrarFactura.tsx` líneas 44–56 → reemplazar por una llamada al helper.

**Test:** `src/features/facturacion/utils/__tests__/validarDatosTimbrado.test.ts` con casos: RFC corto, CP no numérico, todos los campos vacíos, happy path.

**Bump:** `13.84.1` · CHANGELOG: "Extracción de validaciones de timbrado a helper puro testeable".

---

## Paso 10B — Helper de estado de `ContenedorCell`

**Archivo nuevo:** `src/features/embarques/utils/estadoContenedorCell.ts`

Función pura:
```text
derivarEstadoContenedor(embarque, info?, legacyCount?)
  → { count, primero, incompletos, blFalta, pendientes, pendientesTitle }
```

**Editar:** `src/features/embarques/components/embarqueColumns.tsx` líneas 37–66 → `ContenedorCell` queda como componente fino que solo arma JSX a partir del helper.

**No** extraer `ContenedorCell` a archivo propio (es el único consumer; mover el componente sin necesidad genera ruido en git).

**Test:** casos pendientes BL falta, incompletos > 0, modo aéreo (no aplica BL), legacy count fallback.

**Bump:** `13.84.2` · CHANGELOG: "Helper puro para derivar estado de celda de contenedores".

---

## Paso 9 — Spanglish en `src/features/admin/` (parcial, conservador)

Estrategia: renombrar **tipos, interfaces y funciones de dominio** a español. **NO** renombrar archivos de servicios (rompería decenas de imports por estética). **NO** tocar términos técnicos universales: `backfill`, `legacy`, `observability`, `health`, `logs`, `email`.

### 9.1 `services/stats.ts`
- `AdminOrgStats` → `EstadisticasAdminOrg`
- `AdminOrgActivity` → `ActividadAdminOrg`
- `AdminRecentOrg` → `OrganizacionReciente`
- Campos `totalOrgs` → `totalOrganizaciones`, `totalUsers` → `totalUsuarios`

### 9.2 `services/members.ts`
- `GlobalUserRow` → `FilaUsuarioGlobal`
- `OrgMemberRow` → `FilaMiembroOrg`
- `updateOrgMemberRole` → `actualizarRolMiembro`
- `removeOrgMember` → `eliminarMiembro`
- `addOrgMember` → `agregarMiembro`

### 9.3 `services/organizations.ts` + `services/organization/index.ts`
- Unificar `OrgRow` y `OrganizationRow` en un único tipo `FilaOrganizacion` exportado desde `services/organization/index.ts`. Eliminar el duplicado.
- `createOrganization` → `crearOrganizacion`
- `updateAdminOrganization` → `actualizarOrganizacion`
- `setOrganizationActivo` → `establecerOrganizacionActiva`

### 9.4 `services/exportOrg.ts`
- `ExportProgress` → `ProgresoExportacion`
- `ProgressCallback` → `CallbackProgreso`
- `ExportTableResult` → `ResultadoExportTabla`

### 9.5 `services/observability.ts`
- `acknowledgeAlerta` → `reconocerAlerta`
- Tipos `AppLogsQueryInput/Result`, `HealthSummaryRow`, `HealthTimelinePoint`: **dejar en inglés** (términos técnicos de observabilidad).

### 9.6 `services/usuario/availableUsers.ts`
- `UserOption` → `OpcionUsuario`

### 9.7 `domain/roles/roleCatalog.ts`
- `ROLE_LABELS` → `ETIQUETAS_ROL`
- `ROLE_DESCRIPTIONS` → `DESCRIPCIONES_ROL`
- `ROLE_BADGE_CLASSES` → `CLASES_BADGE_ROL`
- `ASSIGNABLE_ROLES_ADMIN_ORG` → `ROLES_ASIGNABLES_ADMIN_ORG`
- `getRoleLabel` → `obtenerEtiquetaRol`
- Dejar `LEGACY_ROLES` (técnico).

### 9.8 `hooks/`
- `useAddOrgMember` → `useAgregarMiembro`
- `useAvailableUsers` interno → `useUsuariosDisponibles`

### Decisiones explícitas
- **NO** renombrar archivos (`organizations.ts`, `members.ts`, etc.): el costo en imports y blame supera el beneficio.
- **NO** tocar `observability.ts`, `backfillLegacy.ts` ni dividirlos: fuera de alcance.
- Cada rename actualiza **todos los call sites** en el mismo commit lógico para no romper build.

**Bump:** `13.85.0` (minor por cambio amplio de API interna) · CHANGELOG: "Estandarización a español de tipos y funciones en módulo admin (sin cambios funcionales)".

---

## Verificación final

1. `bun run lint -- --max-warnings 0`
2. `bun run lint:unused`
3. Smoke test mental: rutas `/admin/usuarios`, `/admin/organizaciones`, `/admin/auditoria` siguen compilando.
4. Cerrar la auditoría con nota en `mem://audit/pendings` marcando pasos 8 y worker-zip como "no se ejecuta — costo > beneficio".

---

## Fuera de alcance (confirmado)

- Paso 8 (renombre PascalCase de columnas).
- Worker para `descargarZip`.
- Renombre de archivos en `features/admin/`.
- Tres-way split de `observability.ts`.
