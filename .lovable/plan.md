
## Objetivo

Que el campo `TipoCambio` de un CFDI en USD/EUR coincida con la **Publicación DOF** que aplica al día de emisión, tal como lo exige el Art. 20 CFF y valida el PAC al timbrar.

## Diagnóstico

El cambio previo a **SF60653** fue incorrecto: esa serie es "Para Pagos" (SAT), no la Publicación DOF. La serie correcta es **SF43718** (FIX / DOF), y la única diferencia entre "FIX" y "DOF" es qué fecha tomas del mismo histórico:

- FIX de hoy = SF43718 con fecha = hoy (se publica ~12:00 hrs)
- Publicación DOF de hoy = SF43718 con fecha = día hábil anterior

`datos/oportuno` devuelve la fila más reciente, así que a partir del mediodía te da el FIX del día — no el DOF vigente. Necesitamos leer un rango y tomar explícitamente la penúltima fila válida.

## Cambios

### 1. `supabase/functions/exchange-rates/index.ts`

- Revertir `SERIE_USD = "SF43718"` (y mantener `SERIE_EUR = "SF46410"`).
- Actualizar el header de doc: la serie es la misma FIX/DOF; el "truco" es la fecha.
- Reemplazar el endpoint por rango de 10 días naturales:
  `https://www.banxico.org.mx/SieAPIRest/service/v1/series/{serie}/datos/{ddmmyyyy_inicio}/{ddmmyyyy_fin}`.
- Nueva función pura `extraerPublicacionDof(data, hoyIso)`:
  - Recorre `datos` de más nuevo a más viejo.
  - Ignora `"N/E"` y valores no numéricos.
  - Ignora la fila cuya `fecha` sea `>= hoy` (esa es el FIX de hoy, que será DOF mañana).
  - Devuelve el primer valor que quede (= FIX del último día hábil anterior a hoy = **DOF vigente hoy**).
- Mantener `extraerUltimoTC` como export para no romper tests existentes; agregar tests nuevos para `extraerPublicacionDof`.
- Ajustar el comentario sobre caché: aún 12 h, pero conviene explicar que Banxico publica el nuevo DOF entre las 10:30–12:00, así que el caché matinal puede quedar corto un día. Alternativa (opcional): reducir TTL a 4 h. Lo dejo como decisión futura, por defecto mantengo 12 h.

### 2. Tests Deno (`supabase/functions/exchange-rates/exchange_test.ts`)

Casos nuevos:
- Dado un histórico con FIX de hoy publicado y FIX de ayer → devuelve **el de ayer** (DOF vigente).
- Dado un histórico sin FIX de hoy (aún no son las 12) y FIX de ayer → devuelve **el de ayer** (mismo comportamiento).
- Con "N/E" en la última fila hábil → salta a la anterior válida.
- Rango vacío → `null` y activa fallback.
- Redondeo a 4 decimales conservado.

### 3. Frontend — sólo docs / copy

Archivos con texto obsoleto (no lógica):
- `src/features/marketing/routes/landingCopy.ts` línea 80 — mantiene "SF43718 y SF46410" (correcto), sólo verificar redacción.
- `src/features/dashboard/routes/ayudaGlosario.ts` línea 61 — agregar aclaración: "publicación DOF = FIX del día hábil anterior".
- `src/features/facturacion/hooks/useBanxicoTipoCambio.ts` header — actualizar comentario sobre el modelo.

### 4. Versionado

- `APP_VERSION` → `13.205.5`.
- `CHANGELOG.md` — nueva entrada `## [13.205.5]` explicando el fix (revirtiendo SF60653 y explicando por qué SF43718 con fecha de ayer es la fuente correcta para CFDI).

### 5. Deploy

- Redesplegar `exchange-rates` (esto vacía caché in-memory).
- Después del deploy, verificar en logs que devuelve un valor consistente con el DOF publicado hoy en `https://www.banxico.org.mx/tipcamb/tipCamMIAction.do`.

## Detalles técnicos

### Cálculo de fechas
```ts
// Rango: últimos 10 días naturales — cubre fines de semana/feriados
function rangoUltimos10Dias(hoy: Date): { inicio: string; fin: string } {
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
  const inicio = new Date(hoy); inicio.setUTCDate(inicio.getUTCDate() - 10);
  return { inicio: fmt(inicio), fin: fmt(hoy) };
}
```

### Selección del valor DOF
```ts
export function extraerPublicacionDof(data: BanxicoResponse, hoyIso: string): number | null {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  // Recorremos de la fecha más nueva a la más vieja
  for (let i = datos.length - 1; i >= 0; i--) {
    const fila = datos[i];
    // Convertir "dd/mm/yyyy" → "yyyy-mm-dd" para comparar
    const [dd, mm, yyyy] = (fila.fecha ?? '').split('/');
    const filaIso = `${yyyy}-${mm}-${dd}`;
    if (filaIso >= hoyIso) continue; // salta el FIX de hoy o futuros
    const num = Number(fila.dato);
    if (Number.isFinite(num) && num > 0) return +num.toFixed(4);
  }
  return null;
}
```

### Impacto en datos ya guardados
Facturas existentes con `tipo_cambio` guardado incorrecto se quedan con ese valor a menos que el usuario dé clic al botón "TC Banxico" en el diálogo de timbrado. No hay backfill automático porque una factura ya timbrada no debe modificar su TC, y una borrador se refresca al presionar el botón.

## No incluido (fuera de alcance)

- No se agrega selector manual entre FIX/DOF/Para Pagos en la UI. Si eventualmente hay que emitir pagos al SAT en USD (SF60653) desde otro módulo, se hará como una edge function separada.
- No se implementa retención histórica del TC DOF en BD. Si más adelante se requiere auditoría (¿cuál era el DOF el día X?), sería una tabla `tipos_cambio_dof` con job diario — otro sprint.
