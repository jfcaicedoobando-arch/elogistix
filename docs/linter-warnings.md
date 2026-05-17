# Hallazgos del linter — estado y justificación

Última corrida: 2026-05-17 (v8.179.0).

## Resueltos en 8.179.0

| Warning | Acción |
|---------|--------|
| `0011 Function Search Path Mutable` (`is_soft_delete_table`) | Se agregó `SET search_path = public` a la función. |
| `0024 RLS Policy Always True` (`app_logs` INSERT) | Política reemplazada: ahora exige rol `authenticated` y `user_id = auth.uid()` (o nulo). Service role usado por crons sigue ignorando RLS. |

## Pendientes intencionales (aceptados)

| Warning | Cantidad | Por qué se acepta |
|---------|----------|-------------------|
| `0014 Extension in Public` | 1 | `pg_trgm` instalado en `public` por defecto al habilitar fuzzy search. Mover de esquema requiere reindex masivo en `clientes`, `embarques`, `cotizaciones`. Riesgo > beneficio para warning informativo. Reevaluar cuando se planee mantenimiento mayor. |
| `0028 Public Can Execute SECURITY DEFINER` | 21 | Funciones públicas usadas por el portal cliente, login y endpoints anónimos (`tracking_public`, `cliente_token_*`, `is_soft_delete_table`). Diseño consciente, ver `mem://technical/security-patterns`. |
| `0029 Authenticated Can Execute SECURITY DEFINER` | 45 | Patrón `has_role()` + RPCs `*_listado`, `app_logs_health_*`, `embarques_*`, `facturas_*`. Necesario para evitar recursión en RLS y centralizar validación. Toda función SECURITY DEFINER fija `search_path` y filtra por `auth.uid()` internamente. |

## Política de revisión

- Cada función SECURITY DEFINER nueva debe documentar en su comentario SQL por qué necesita el privilegio y qué filtros aplica internamente.
- Revisar este archivo al cierre de cada bloque del roadmap a producción.
- Si Supabase publica un linter nuevo de severidad ERROR, debe resolverse antes del siguiente despliegue mayor.
