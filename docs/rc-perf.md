# Performance Smoke — Release Candidate

> Plantilla de medición previa al corte de `12.0.0-rc.1`.
> Ejecutar contra el entorno **Test** con dataset realista.

## 1. Dataset

| Entidad | Volumen mínimo | Fuente |
|---|---|---|
| Embarques | ≥ 500 (mezcla FCL/LCL, todos los estados) | seed o copia de prod-like |
| Cotizaciones | ≥ 200 | idem |
| Leads / Oportunidades | ≥ 1 000 / ≥ 300 | idem |
| Clientes | ≥ 100 con docs cargados | idem |
| Bitácora | ≥ 5 000 entradas | generadas |

## 2. Métricas a capturar

Tomar 3 muestras y reportar mediana. Hardware de prueba: documentar CPU / RAM / red.

| Vista | Métrica objetivo | Mediana | Notas |
|---|---|---|---|
| Login → primer paint dashboard | < 2.0 s | __ | |
| `/embarques` lista paginada (50/page) | TTI < 1.5 s | __ | |
| `/embarques` filtro debounced (texto) | resp. < 400 ms tras 300 ms debounce | __ | |
| `/dashboard` carga inicial | TTI < 2.0 s | __ | |
| `/crm/oportunidades` con 300 cards | TTI < 1.8 s | __ | |
| `/cotizaciones/:id` detalle | TTI < 1.0 s | __ | |
| Wizard nuevo embarque (paso 1 → 5) | sin lag perceptible | __ | |
| Ctrl+K búsqueda global | resp. < 500 ms | __ | |
| Export CSV 500 embarques | < 3.0 s | __ | |
| PDF proforma (10 partidas) | < 2.0 s | __ | |

## 3. Memoria / red

- [ ] Heap JS estable tras 10 min navegando entre páginas (sin leak > 50 MB).
- [ ] Bundle inicial < 1.5 MB gz.
- [ ] Sin requests Supabase repetidas (mismo PK en < 1 s).

## 4. Rollback dry-run

| Paso | Resultado | Duración |
|---|---|---|
| 1. Crear backup de Test | __ | __ |
| 2. Hacer cambio destructivo controlado (DELETE en tabla no crítica) | __ | __ |
| 3. Restaurar backup según `docs/backups-rollback.md` | __ | __ |
| 4. Verificar integridad (tests + spot-check UI) | __ | __ |

Objetivo total: **< 30 minutos** end-to-end.

## 5. Resultados

Llenar después de la corrida:

- Fecha: __
- Operador: __
- Commit / versión: __
- Resumen ejecutivo: __
- Bloqueantes detectados: __
