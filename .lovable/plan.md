# Investigación: badge "5 embarques" en el sidebar

## Qué significa el badge

El número junto a "Embarques" en el menú lateral suma tres conteos:

1. **Embarques en demora** — con ETA vencida hace 7+ días y aún en estado "Arribo".
2. **Garantías atoradas** — depósitos de garantía sin liberar hace más de 30 días.
3. **Pendientes administrativos** — embarques Entregados/EIR con CXC pendiente, CXP pendiente, documentos faltantes o venta no facturada.

Código: `src/hooks/layout/useSidebarAlerts.ts` + `useAppSidebarSections.ts`.

## Qué encontré para `demo@librecarga.com`

El usuario tiene **dos memberships** (mismo bug que ya arreglamos para el agente):

| Org | Embarques | created_at |
|---|---|---|
| Demo Logistics MX (real) | 27 | más reciente |
| "Mi organización" (huérfana, creada por trigger) | 0 | más antigua |

Y las dos RPC que alimentan el badge **eligen org distinta** cuando el usuario pertenece a varias:

- `current_user_org_id()` → `ORDER BY created_at ASC` → devuelve la **huérfana** (0 embarques) → demora=0, garantías=0, facturas vencidas=0.
- `embarques_admin_pendientes_count()` → `ORDER BY created_at DESC` → devuelve **Demo Logistics MX** → ahí salen los 5 pendientes administrativos.

Por eso el badge marca **5**: son 5 embarques de Demo Logistics MX con algo pendiente (factura por cobrar/pagar, documento faltante o venta sin facturar). No son demoras ni garantías.

## Causa raíz (analogía)

Es como tener dos llaveros con el mismo nombre. Una función agarra el llavero viejo (vacío) y otra agarra el llavero nuevo (con llaves). Resultado: el conteo se hace contra organizaciones diferentes y el usuario ve un número que parece inconsistente con su org real.

Dos problemas combinados:

- **A.** El trigger `handle_new_user_signup` sigue creando una "Mi organización" extra cada vez que se crea un usuario, aunque ya se le asigne a la org correcta después. Mismo síntoma que con `agente.demo@librecarga.com`.
- **B.** Las RPC del sidebar resuelven la org del usuario con criterios distintos (ASC vs DESC), así que para usuarios multi-org el badge es no-determinista.

## Plan propuesto

### 1. Limpieza inmediata para `demo@librecarga.com` (migración SQL)
- Quitar el membership en la org huérfana `95fe7022-…` (Mi organización).
- Archivar esa org huérfana (igual que hicimos con la del agente; no se borra por dependencias en bitácora).
- Verificar que queda solo en **Demo Logistics MX**.

Esto, por sí solo, ya hace que el badge sea consistente: ambas RPC apuntarán a la misma org y el 5 reflejará realmente los 5 embarques con pendientes administrativos de Demo.

### 2. Saber qué embarques son los 5
Después de la limpieza, listar (en la respuesta del chat, no en código) cuáles son los 5 embarques de Demo Logistics MX que disparan el badge y por qué motivo (CXC, CXP, docs, venta sin facturar) para que puedas validarlos.

### 3. (Opcional, recomendado) Homogeneizar las RPC
Cambiar `embarques_admin_pendientes_count` para que también use `current_user_org_id()` en lugar de su propio `ORDER BY DESC`. Así nunca vuelve a divergir aunque un usuario quede multi-org por accidente.

### 4. Versionado y changelog
- `APP_VERSION` → `13.130.4`.
- Entrada en `CHANGELOG.md` describiendo la limpieza de la org huérfana del demo y (si se aprueba el paso 3) la homogeneización de la RPC.

## Fuera de alcance
- No tocamos `handle_new_user_signup` en este plan (mismo pendiente que ya tenías anotado). Si quieres lo agregamos en un plan aparte para que ningún usuario nuevo herede una "Mi organización" huérfana.
- No se cambia RLS ni edge functions.

## Detalles técnicos
- Migración 1: `DELETE FROM organization_members WHERE user_id='7c95b249-…' AND organization_id='95fe7022-…';` + `UPDATE organizations SET deleted_at=now() WHERE id='95fe7022-…';`
- Migración 2 (opcional, paso 3): `CREATE OR REPLACE FUNCTION embarques_admin_pendientes_count` reemplazando el `SELECT om.organization_id … ORDER BY created_at DESC LIMIT 1` por `SELECT current_user_org_id()`.
- Archivos frontend a tocar: solo `src/constants/appVersion.ts` y `CHANGELOG.md`.

¿Apruebo este plan tal cual, o quieres que incluya también el paso 3 (homogeneizar la RPC) y/o el arreglo del trigger?
