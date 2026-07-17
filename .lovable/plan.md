
# Prueba E2E de aislamiento multi-tenant (2 orgs)

## Objetivo
Un solo spec Playwright que, en cada corrida, provisiona **dos organizaciones dedicadas** (`E2E Multi-Tenant A` y `E2E Multi-Tenant B`), un admin por org, y datos "trazadores" en cada una. Luego se autentica como cada usuario y verifica que **no** puede ver, buscar, abrir por URL, ni descargar recursos de la otra org.

## Componentes a crear

### 1. Edge Function — `e2e-provision-multi-tenant`
- Ubicación: `supabase/functions/e2e-provision-multi-tenant/`
- Protegida por header `x-e2e-secret` = `E2E_PROVISION_SECRET` (mismo mecanismo que `e2e-provision-users`).
- Payload:
  ```json
  {
    "org_a": { "nombre": "E2E MT-A", "admin_email": "...", "admin_password": "..." },
    "org_b": { "nombre": "E2E MT-B", "admin_email": "...", "admin_password": "..." }
  }
  ```
- Idempotente: por cada org busca `organizations` por nombre exacto; si no existe la crea (el trigger `handle_new_organization` siembra catálogos neutros automáticamente).
- Para cada org siembra 1 row en `clientes`, `embarques`, `facturas`, `cotizaciones` con `organization_id` correcto, todas etiquetadas con un marcador único (`referencia_cliente = 'E2E-MT-A-{uuid}'`, etc.) para asserts confiables.
- Sube 1 archivo pequeño de storage a `documentos-embarque/{orgId}/{embarqueId}/marker.txt` con contenido `E2E-MT-A-<uuid>`.
- Devuelve JSON:
  ```json
  { "ok": true,
    "org_a": { "id": "...", "admin_user_id": "...",
               "embarque_id": "...", "factura_id": "...",
               "cliente_id": "...", "cotizacion_id": "...",
               "storage_path": "documentos-embarque/.../marker.txt",
               "marker": "E2E-MT-A-..." },
    "org_b": { ... } }
  ```

### 2. Script de provisioning — `scripts/e2e/provision-multi-tenant.ts`
- Lee `.env.e2e`, invoca la edge function, escribe el resultado en `e2e/.tmp/multi-tenant.json` (git-ignored) para consumo del spec.
- Comando: `bun run e2e:provision-multi-tenant`.
- Se ejecuta como paso previo al spec en local y en CI (`.github/workflows/e2e.yml`).

### 3. Fixture — `e2e/fixtures/multiTenant.ts`
- Carga `e2e/.tmp/multi-tenant.json` y expone `loadMultiTenantFixture()` con las credenciales + IDs + markers de las dos orgs.
- Si el archivo no existe → `test.skip(...)` con warning claro.

### 4. Spec — `e2e/specs/26-multi-tenant-isolation.spec.ts`
Corre bajo un nuevo project `chromium-multi-tenant` que NO usa `storageState` compartido (cada test hace su propio `loginAs`).

Estructura (2 sentidos × 4 dominios + 1 catálogos + 1 storage):

- **Org A → Org B (y viceversa)** para cada dominio:
  - `embarques`: URL directa `/embarques/{orgB.embarqueId}` → not-found; listado + búsqueda global `Ctrl+K` con marker de B no aparece; contador de red `/rest/v1/embarques?id=eq.<orgB.id>` devuelve `[]`.
  - `facturas`: idéntico contra `/facturacion/{id}`.
  - `clientes`: idéntico contra `/clientes/{id}`.
  - `cotizaciones`: idéntico contra `/cotizaciones/{id}`.
- **Catálogos sembrados** (`factura_series`, `crm_etapas_pipeline`, `crm_motivos_perdida`, `presupuesto_categorias`): usuario de A ve sólo las filas de A (query REST vía `page.request` con el token del usuario A), no las de B.
- **Storage**: usuario A pide signed URL para `orgB.storage_path` → 403/not-found; y viceversa.

### 5. Config Playwright — `playwright.config.ts`
- Nuevo project `chromium-multi-tenant` que sólo corre este spec, `fullyParallel: false`, `workers: 1`, sin `storageState` compartido.
- Excluir el spec de los projects existentes.

### 6. CI — `.github/workflows/e2e.yml`
- Nuevo step `Provision multi-tenant` que corre `bun run e2e:provision-multi-tenant` antes del matrix Playwright.
- Nuevos secrets requeridos:
  `E2E_MT_A_EMAIL`, `E2E_MT_A_PASSWORD`, `E2E_MT_B_EMAIL`, `E2E_MT_B_PASSWORD`.

### 7. Limpieza
- Añadir opción `?cleanup=true` en la edge function que borra las 2 orgs E2E (cascada via `ON DELETE CASCADE` ya definido). Se invoca al final del spec en `test.afterAll` con `test.info().status === 'passed'` para no borrar evidencia en fallos.
- `e2e/.tmp/` a `.gitignore`.

## Detalles técnicos

```text
       Provisioner (edge fn, service_role)
                │
                ├── crea Org A ──┐         crea Org B ──┐
                │                │                     │
                │    trigger handle_new_organization    │
                │    siembra catálogos neutros por org  │
                │                                       │
                └── seed rows (embarque/factura/cliente/cotización/storage)
                                    │
                                    ▼
              e2e/.tmp/multi-tenant.json (IDs + markers + creds)
                                    │
                                    ▼
           spec 26 corre 2 sesiones y hace asserts cruzados
```

## Fuera de alcance
- No se prueba impersonación de super_admin (ya tiene test unitario).
- No se prueban roles `cliente`/`agente_carga` cross-org (ya cubiertos por spec 06 + tests SQL existentes).
- No se refactoriza el spec 06 existente — se complementa, no se reemplaza.

## Bump de versión
`APP_VERSION` a `13.301.53` + entrada en `CHANGELOG.md` describiendo la nueva red de seguridad multi-tenant.

## Riesgos
- La edge function toca storage: si el bucket `documentos-embarque` no existe en el ambiente, el script falla explícito. Añadimos guardia con mensaje accionable.
- La creación de orgs desde la edge function usa el service_role directamente (no la RPC `provision_organization` que exige super_admin del caller), y por tanto **elude** la validación de rol. Es aceptable en un edge function con secret share, pero lo documentamos en el JSDoc y validamos que sólo la usa el pipeline E2E.

¿Aprueba el plan para implementarlo?
