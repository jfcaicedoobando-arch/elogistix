# Diferenciar las pestañas "Resumen" y "Mi día" del CRM

Hoy ambas vistas muestran prácticamente lo mismo (`useCrmInicioVM` con las 4 tarjetas: Actividades hoy, Cerrando semana, Cotizaciones sin respuesta, Leads sin contactar + KPIs). La idea es darle a cada una un propósito claro.

## Analogía
Piensa en el coche: **Mi día** es el GPS con la siguiente indicación ("gira a la derecha, llama a este cliente"). **Resumen** es el tablero del coche: velocímetro, combustible, temperatura — números que te dicen cómo va el viaje en general.

---

## 1) Pestaña "Mi día" (`/crm/mi-dia`) — Tareas y acciones

Se vuelve la vista **100 % accionable**. Solo tarjetas con cosas que hacer hoy/esta semana.

**Contenido:**
- **Hoy**
  - `NextBestActionsCard` (todas, no recortadas a 3)
  - `ActividadesHoyCard`
- **Esta semana**
  - `CerrandoSemanaCard`
  - `CotizacionesSinRespuestaCard`
  - `LeadsSinContactarCard`

**Se quita:** la tira de KPIs/Pipeline (se va a Resumen).

Mantiene el `CrmSubheader` con la fecha del día.

---

## 2) Pestaña "Resumen" (`/crm`) — KPIs y gráficas ejecutivas

Se vuelve un mini-dashboard ejecutivo, sin listas de tareas individuales.

**Contenido:**
1. **Strip de KPIs** (la actual de `KpiStrip`): Leads, Oportunidades abiertas, Actividades pendientes, Pipeline ponderado.
2. **3 tarjetas grandes de totales** (de `useForecast`): Pipeline, Ponderado, Ganado — formato moneda compacta MXN.
3. **Embudo de etapas** (de `useReportesCRM().embudo`) como barras horizontales por etapa con cantidad.
4. **Forecast por mes** (de `useForecast().porMes`) como mini-tabla compacta o barras (mes vs ponderado).
5. **Leaderboard vendedores** (componente `LeaderboardVendedores` ya existente) — top 5.

**Se quita:** las 4 tarjetas de acciones individuales (viven en Mi día).

> Nota: aunque hay solapamiento con `/crm/analitica`, Resumen muestra **lectura rápida** (totales + embudo + top vendedores) y Analítica mantiene el desglose completo (tablas por mes/vendedor, motivos de pérdida, conversión por fuente).

---

## Detalles técnicos

**Archivos a editar:**
- `src/features/crm/routes/MiDia.tsx` — quitar la sección "Pipeline" (stat strip), dejar NBA completas + las 4 tarjetas agrupadas por Hoy / Esta semana.
- `src/features/crm/routes/CrmDashboard.tsx` — reescribir el cuerpo:
  - Conservar `KpiStrip` con los 4 KPIs.
  - Agregar 3 cards de totales usando `useForecast` (`totalPipeline`, `totalPonderado`, `totalGanado`).
  - Agregar tarjeta "Embudo" con `useReportesCRM().embudo` (barras horizontales simples con `<div>` + ancho proporcional, sin nueva dependencia).
  - Agregar tarjeta "Forecast por mes" con `useForecast().porMes` (tabla compacta, máx. 6 meses).
  - Agregar `<LeaderboardVendedores />`.
  - Quitar `NextBestActionsCard`, `ActividadesHoyCard`, `CerrandoSemanaCard`, `CotizacionesSinRespuestaCard`, `LeadsSinContactarCard`.
- `src/features/crm/components/CrmSubheader.tsx` (opcional) — usar también en Resumen con contexto "Resumen ejecutivo".

**Hooks reutilizados (ya existen, sin cambios):**
- `useCrmInicioVM` (solo `kpis` en Resumen; completo en Mi día).
- `useForecast`, `useReportesCRM`, `useLeaderboardVendedores`.

**Sin migraciones, sin nuevas dependencias, sin cambios de rutas.** Las barras del embudo se hacen con Tailwind (`bg-primary/20` + ancho relativo), respetando tokens semánticos del diseño.

**Versionado:**
- Bump `APP_VERSION` a `13.117.3` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md`: "CRM: Resumen ahora muestra KPIs y gráficas ejecutivas; Mi día se enfoca en tareas accionables."

**Pruebas:** los componentes reutilizados ya están testeados; no se agregan tests nuevos en este paso (cambio puramente de composición de UI).
