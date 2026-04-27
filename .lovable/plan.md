
# Auditoría visual UI/UX — Fase 4 (v8.99.15)

## Hallazgos

Capturé pantallas en tablet (768px) y laptop (1366px). Encontré **8 problemas** nuevos o regresiones, ordenados por severidad.

### 1. `toTitleCase` demasiado agresivo (CRÍTICO)
En `/clientes` se ven nombres mal capitalizados:
- "BUENO Alimentos" — "BUENO" tratado como sigla
- "SANTA Catarina, NUEVO León" — palabras válidas tratadas como siglas
- "Chipilo DE Francisco Javier MINA, Puebla" — "DE" en mayúsculas, "MINA" tratado como sigla
- "Distribuciones Agrisolutions S a P I DE CV" — siglas mal partidas
- "Comercializadora Vistrain-gonzalez" — segundo segmento tras guión sin capitalizar

**Causa**: el regex `^([A-Z]\.?){2,5}$` matchea cualquier palabra de 2-5 letras todas mayúsculas. Hay que **invertir** la lógica: solo preservar mayúsculas si el original ya tiene puntos (S.A., C.V.) o si está en una whitelist mínima (RFC, CFDI, IVA, USD, EUR, MXN, USA, EU, UE).

### 2. Cliente en MAYÚSCULAS en tablas y cards principales
- Tabla **Embarques**: "INDIMEX TRADING", "ROLLOS Y ETIQUETA..."
- Tabla **Cotizaciones**: "INDIMEX TRADING", "GOLDEN FOODS", "BUENO ALIMENTOS"
- Cards **Alertas de Demora** y **Próximos Arribos** en dashboard: "INDIMEX TRADING", "CORPORATIVO ESPECIALIZADO EN COMERCIO ELITE..."

Aplicar `toTitleCase` (versión corregida) en estos displays.

### 3. Fecha con capitalización incorrecta en Operaciones
"Domingo, 26 De Abril De 2026" — el fix de Fase 1 solo se hizo en `Dashboard.tsx`. Replicar en el header de `/operaciones`.

### 4. Tarjetas de operadores muestran email en vez de nombre
En `/operaciones`, debajo del gráfico, las cards muestran "alan.hernandez@elogis...", "magali.reynoso@elogi...". El gráfico ya muestra el nombre derivado, las cards no. Aplicar el mismo helper de derivación de nombre.

### 5. Columna "Estado" cortada en tabla de Embarques
En 1366px la columna se trunca a "Confir...", "Arribo", "En Trán...". La tabla excede el viewport por la suma de `min-w` de columnas. Reducir min-w de columnas largas (cliente a 140px, ensanchar Estado a 110px y `whitespace-nowrap`), o envolver la tabla en scroll horizontal con sombra de hint.

### 6. Sidebar siempre visible en tablet (768px)
El sidebar fijo de 256px en pantallas <1024px deja solo ~510px para el contenido, lo que hace que la línea de tiempo del dashboard solo muestre 3 de 5 estados aunque tenga `min-w-[600px]` (el overflow-x-auto sí funciona pero la UX pierde). Hacer el sidebar **colapsable por defecto en <lg** (botón hamburguesa toggle ya existente).

### 7. Vigencia de cotizaciones sin indicador visual
La columna "Vigencia" muestra solo la fecha sin advertencia visual cuando está próxima a vencer. Agregar badge sutil:
- Vigencia ≤ 3 días: badge rojo "Vence pronto"
- Vencida: badge rojo "Vencida"
- Sin urgencia: solo fecha

### 8. Formato de fecha con coma redundante en Cotizaciones
"23/04/2026, 04:06 p.m." → más limpio: "23/04/2026 16:06" (24h, sin coma, sin a.m./p.m.). Alinea con el estándar de localización mexicana del proyecto.

## Cambios a realizar

### Frontend

**`src/lib/formatters/index.ts`** — reescribir `toTitleCase`:
- Solo preservar mayúsculas si la palabra ORIGINAL contiene puntos (`S.A.`, `C.V.`, `S.A.P.I.`)
- Whitelist explícita corta: `RFC`, `CFDI`, `IVA`, `USD`, `EUR`, `MXN`, `USA`, `EU`, `UE`, `LCL`, `FCL`, `BL`, `ETD`, `ETA`, `CSF`
- Conectores en minúscula (de, del, la, etc.) solo si NO son la primera palabra
- Manejar guiones internos: capitalizar después de `-`
- Quitar números pegados al final del nombre (display only): "Eduardo Vargas1" → "Eduardo Vargas"

**`src/components/embarque/embarqueColumns.tsx`** — aplicar `toTitleCase` al render de cliente; ensanchar columna Estado (`w-[110px]`), reducir cliente (`max-w-[160px]`).

**`src/pages/cotizaciones/Cotizaciones.tsx`** — `toTitleCase` en cliente y reformatear fecha sin coma + 24h; agregar badge de vigencia.

**`src/components/dashboard/AlertasDemoraCard.tsx`** y **`ProximosArribosCard.tsx`** — `toTitleCase` en `cliente_nombre`.

**`src/pages/operaciones/Operaciones.tsx`** (o componente de header) — replicar la corrección de capitalización de fecha que se hizo en `Dashboard.tsx`.

**`src/components/operaciones/OperadorCard.tsx`** — usar `getNombreCorto(email)` (helper que ya existe en `useDesempenoChartData`) en `operador.nombre` cuando viene como email.

**`src/components/layout/Sidebar.tsx`** (o equivalente) — colapsar por defecto en breakpoint `<lg` (1024px); mantener toggle accesible.

**`src/content/changelog/v8/chunks/0.ts`** — entrada v8.99.15.

### Sin cambios en BD

Solo trabajo de presentación; ningún schema o RPC se modifica.

## Sin trabajo

- Iconos del card "Próximos Arribos" se ven correctos en revisión cercana (no es bug, es el indicador de modo).
- KPIs de Operaciones (Cargas activas, Contenedores, Profit total, Alertas) se ven bien.

## Validación

- Capturar screenshot post-fix en 768px y 1366px de: Dashboard principal, Embarques (lista), Cotizaciones (lista), Clientes (lista) y Operaciones.
- Verificar en BD vía sample: clientes "BUENO Alimentos", "SANTA Catarina, NUEVO León", "INDIMEX TRADING", "Corporativo Especializado EN Comercio ELITE S.A. DE C.V." se renderizan correctamente.
