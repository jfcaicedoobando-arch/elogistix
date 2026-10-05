## 4. Filtro por estado en Empresas
En la lista de Empresas se agrega un filtro **Estado: Todos / Lead / Prospecto / Cliente**. El filtro queda en la dirección de la página, así se puede compartir el enlace.

## 5. Qué pasa con las pantallas de Leads y Prospectos
- El menú deja de mostrar "Leads" y "Prospectos".
- Los enlaces viejos llevan a Empresas ya filtradas (Lead o Prospecto), así nadie pierde un favorito.
- La tabla de leads se conserva como respaldo de solo lectura; no se borra nada.

## Importante
- El cambio de estructura y el traspaso de datos de los 24 leads se aplican **cuando aceptes este borrador**, no antes. Es un traspaso masivo de datos, por eso queda atado a esa aprobación.
- No se cambian la versión ni el changelog sin tu autorización, y no se publica.

## Detalles técnicos
- Migración aditiva en el draft: columna `crm_empresas.estado_crm text not null default 'Lead'` con CHECK (`Lead`,`Prospecto`,`Cliente`) e índice por `(organization_id, estado_crm)`.
- En la misma migración: alta de las ~23 propiedades nuevas en `crm_propiedades` (objeto `empresa`) para cada organización con leads, y backfill idempotente a `crm_valores` desde `crm_leads` vía `crm_empresas.lead_origen_id` / `crm_contactos.lead_origen_id`, sólo cuando no exista valor (`ON CONFLICT DO NOTHING`). Mapeo de opciones de Fuente y Tipo de transporte por etiqueta.
- Estado inicial: `Convertido` o `cliente_id` no nulo → Cliente; `Prospecto` → Prospecto; resto → Lead.
- RPC `crm_empresa_pasar_a_prospecto(p_empresa_id)` SECURITY DEFINER, `org_scope()`, idempotente: cambia estado y crea/reutiliza la oportunidad en etapa `Prospecto` ligada vía `crm_oportunidad_empresa`. GRANT sólo a `authenticated`.
- El trigger/flujo existente de alta a Clientes también marca `estado_crm='Cliente'`.
- Frontend: filtro con `useFiltroUrl("estado", …)` en la lista de Empresas (servicio `objetosCrm.ts`), botón en la ficha, redirecciones de `/crm/leads` y `/crm/prospectos` en `crmRoutes.tsx`, y retiro de esas entradas del menú. Archivos ≤200 líneas.
- Validación: pruebas focalizadas del servicio y del filtro; `db:postcheck` tras aceptar. CI/RLS completos quedan para GitHub Actions.
