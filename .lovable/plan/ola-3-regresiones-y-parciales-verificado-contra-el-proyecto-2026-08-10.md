# Ola 3 — regresiones y parciales (verificado contra el proyecto real)

Revisé los 7 puntos del documento contra el código y la base de datos. Cinco son bugs reales, uno ya está resuelto y dos migraciones de datos no aplican porque no hay filas afectadas.

## Qué confirmé

| ID | Veredicto | Evidencia |
|----|-----------|-----------|
| RG1 (bucle de redirect) | Real, arreglar | `ProtectedRoute.tsx` hace `Navigate to="/"` cuando no hay acceso y `HomeRoute.tsx` reenvía a `/inicio` sin mirar el rol; no existe ninguna ruta `/sin-acceso` |
| RG1c (migración de datos) | No aplica | `organization_members` con rol `super_admin`: **0 filas** |
| RG2 (RFC genérico) | Real, arreglar | El cuerpo de `convertir_prospecto_a_cliente_rpc` no menciona `XAXX010101000` ni `XEXX010101000` |
| RG3a (membresías `viewer` degradadas) | No aplica | Membresías `viewer` con rol global de escritura: **0 filas** |
| RG3b (`has_any_role_efectivo`) | Real, arreglar | La función actual no tiene bypass de `super_admin`: una membresía baja en un tenant lo bloquea |
| P1 (ajustes sin transacción) | Real, arreglar | `crearAjustesFacturaProveedor.ts` hace 3 llamadas sueltas (borrado + insert conceptos + insert puentes) |
| P2 (admin fail-open) | Real, arreglar | `portales.ts` y `listado.ts` usan `if (orgId) query = query.eq(...)` |
| P4 (invalidaciones) | Ya resuelto en parte | `useMarcarCostoPagado` ya invalida facturas/embarques/CxP; faltan `['conceptos_costo']` y `compras.all` |
| P3 (purga de `.env` en git) | Fuera de alcance aquí | `.env` sí sigue trackeado, pero el historial de git lo administra la plataforma: no puedo reescribirlo desde aquí. Contiene sólo llaves publishable (públicas por diseño) |

## Qué voy a implementar

### 1. Fin del bucle de redirect (RG1)
- Nueva pantalla `SinAcceso` (misma estética que `NotFound`) con SEO, "Ir a Ayuda" y "Cerrar sesión".
- Registrarla en las rutas protegidas **sin** `allowedRoles` (como `/ayuda`).
- `ProtectedRoute`: cuando el guard falla, ir a `/sin-acceso` en vez de `/`.
- `HomeRoute`: si hay sesión pero no hay rol efectivo, ir a `/sin-acceso`.

Analogía: hoy el portero te manda a la recepción y la recepción te manda al portero, en círculo. Ahora hay una sala de espera con un cartel que explica qué pedirle a tu administrador.

### 2. RFC genérico no fusiona clientes (RG2)
Migración con `CREATE OR REPLACE` de `convertir_prospecto_a_cliente_rpc`: el match por RFC excluye `XAXX010101000` y `XEXX010101000`, así dos prospectos "público en general" ya no terminan siendo el mismo cliente.

### 3. `super_admin` no se auto-bloquea (RG3b)
Migración que reescribe `has_any_role_efectivo` con bypass explícito de `super_admin` antes de la conjunción estricta, conservando REVOKE/GRANT. **No** incluyo las dos migraciones de datos (RG1c/RG3a): hoy no tocarían ninguna fila.

### 4. Ajustes de factura de proveedor en una transacción (P1)
- Nueva RPC `crear_ajustes_factura_proveedor_rpc(p_factura_id, p_ajustes)`: `SECURITY DEFINER`, `SET search_path`, `FOR UPDATE` sobre la factura, validación `is_org_member`, códigos `LC_*`, REVOKE/GRANT. Toma org/proveedor/folio/moneda/fecha de la propia factura para que el cliente no pueda mandar datos inconsistentes.
- `crearAjustesFacturaProveedor.ts` queda como cálculo del delta (currency.js, tolerancia 0.01) + una sola llamada a la RPC.
- Ajustar el call-site en `useNuevaFacturaProveedorForm.sideEffects.ts`, la firma de la RPC en los tipos generados y los tests del servicio.

### 5. Servicios admin fail-closed (P2)
- `fetchUsuariosOrganizacion`, `fetchUsuariosPortalCliente` y `fetchUsuariosPortalAgente` lanzan error descriptivo si no reciben `organizationId`, antes de tocar la base.
- Los hooks correspondientes no disparan la query cuando no hay tenant activo (`enabled: ... && orgScope !== null`).
- Actualizar los tests que hoy asumen "sin orgId = todas las organizaciones".

### 6. Invalidaciones faltantes (P4)
Agregar `['conceptos_costo']` (raíz, para cubrir todos los embarques) y `compras.all` a `useMarcarCostoPagado`, sin quitar ninguna invalidación existente.

## Detalles técnicos
- Migraciones nuevas con nombre `YYYYMMDDHHMMSS_ola3_*.sql`, comentarios en español, `SECURITY DEFINER` + `SET search_path = public`, REVOKE/GRANT explícitos.
- Los archivos tocados se mantienen bajo 200 líneas (Power of 10 #4); si `useFacturas.ts` o el servicio de ajustes se pasan, se parten en módulos vecinos.
- Cierre: `bunx vitest run` de los módulos afectados + auditoría de arquitectura, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Fuera de alcance
- P3: la purga del historial de git debe hacerla el equipo fuera de la plataforma (clon espejo de respaldo + `git filter-repo` + force-push coordinado). Puedo documentar el procedimiento en `docs/` si lo quieres.
