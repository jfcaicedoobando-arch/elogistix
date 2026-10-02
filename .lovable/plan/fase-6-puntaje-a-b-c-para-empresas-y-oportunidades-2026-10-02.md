# Fase 6 — Puntaje A/B/C para Empresas y Oportunidades

## Qué vas a ver
- En la ficha de cada **Empresa** y **Oportunidad**: una insignia **A / B / C** con el puntaje (0–100) y el desglose de cuántos puntos dio cada dato. Si falta un dato, sale como "Sin capturar (0 pts)" para que el vendedor sepa qué completar.
- En las listas de Empresas y Oportunidades: una columna **Puntaje** que se puede ordenar y filtrar por A, B o C.
- Una pantalla nueva **CRM → Puntaje** (solo super admin) para cambiar criterios, puntos y los cortes de A/B/C sin pedir cambios de programación.

Cortes iniciales: **A = 80–100, B = 50–79, C = menos de 50** (editables).

## Criterios propuestos (editables después)

Empresa (suman 100):
| Dato | Puntos |
|---|---|
| Volumen de importación USD | ≥ 1M: 30 · 250K–1M: 20 · < 250K: 10 |
| Potencial mensual TEUs | ≥ 10: 25 · 3–9: 15 · 1–2: 5 |
| Tipo de transporte | Marítimo: 15 · Aéreo: 10 · Terrestre: 5 (en varias, cuenta el mayor) |
| Tiene agente aduanal o transportista propio | No: 15 · Sí: 5 |
| Perfil de crédito (texto) | Capturado: 15 |

Oportunidad (suman 100):
| Dato | Puntos |
|---|---|
| Monto estimado (USD) | ≥ 50K: 30 · 10K–50K: 20 · < 10K: 10 |
| Etapa | Negociación: 25 · Calificado: 15 · Prospecto: 5 |
| Complejidad | Baja: 15 · Media: 10 · Alta: 5 |
| Tiene contacto ligado | Sí: 15 |
| Tiene solicitud a Pricing respondida | Sí: 15 |

Revisa estos números: son mi propuesta. Si me pasas otros, los cargo así.

## Cómo funciona
- El puntaje se calcula al momento de abrir la ficha o la lista, con los datos vigentes: no se guarda una copia que se pueda quedar vieja.
- Si cambias un criterio, todas las calificaciones se actualizan solas.
- Oportunidades Ganadas/Perdidas no se califican (muestran "—").

## Detalles técnicos
- Tablas `crm_scoring_reglas` (objeto, criterio, tipo de regla rango/opción/capturado/existe, puntos, orden, activa) y `crm_scoring_cortes` (objeto, min_a, min_b). Globales como `crm_propiedades`: leen miembros, escribe solo super admin. GRANTs + RLS.
- RPC `crm_puntaje(p_objeto, p_ids uuid[])` SECURITY DEFINER acotada a `org_scope()`: devuelve puntaje, letra y desglose JSON. Las listas la llaman con los ids de la página; el filtro A/B/C se aplica en servidor vía RPC paginada.
- Frontend: `services/scoringCrm.ts`, `hooks/useScoringCrm.ts`, `components/scoring/` (InsigniaPuntaje, DesglosePuntajeCard, editor de reglas y cortes), ruta `/crm/puntaje` con `isSuperAdmin`.
- Validación: tsgo, eslint y pruebas focalizadas del cálculo; `db:postcheck` + baseline. Sin publicar ni cambiar versión.
