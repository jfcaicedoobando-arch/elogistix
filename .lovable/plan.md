
## Diagnóstico de los correos actuales

Los tres correos (`cotizacion-enviada.tsx`, `proforma-enviada.tsx`, `factura-enviada.tsx`) ya comparten paleta y estructura, pero cada uno **duplica** ~40 líneas de estilos, redefine `Row`, redefine `Firma`, y tienen inconsistencias visibles:

| Aspecto | Cotización | Proforma | Factura |
|---|---|---|---|
| Header con logo | ❌ | ❌ | ❌ |
| Título | H1 azul marino | H1 azul marino | H1 azul marino |
| Etiqueta de tipo de documento (chip) | ❌ | ❌ | ❌ |
| Botón secundario | `btnSecondary` variante A | no tiene | `btnSecondary` variante B (distinta) |
| Bloque "Este correo se generó automáticamente…" | 1 línea | 2 líneas distinto texto | 1 línea distinto |
| Componente `Row`/`Firma` | redefinido | redefinido | redefinido |

Analogía: son tres cartas con el mismo membrete a mano — parecidas, pero cada una escrita en máquina distinta. Queremos un solo formato de papelería.

## Qué se propone construir

Un módulo compartido `_shared/transactional-email-templates/_layout/` que exporte **un layout único** y **tokens de estilo únicos**, y refactorizar los 3 templates para consumirlo. Sin cambios de datos: mismas `Props`, mismos `templateData`, misma lógica de envío, mismo `subject`. Es un rediseño puramente visual.

### 1. Nuevo shell compartido `EmailLayout.tsx`

Envoltorio con la misma estructura para los 3 correos:

```text
┌─────────────────────────────────────┐
│ [Logo Libre Carga]      COTIZACIÓN  │  ← Header con logo + chip tipo
├─────────────────────────────────────┤
│ Cotización COT-2026-0042            │  ← Título + folio grande
│ Hola María, adjuntamos…             │  ← Lead
│                                     │
│ ┌── Detalles ────────────────────┐  │  ← Card gris con datos clave
│ │ Ruta      CNSHA → MXVER        │  │
│ │ Total     $145,320.00 MXN      │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌── Mensaje ─────────────────────┐  │  ← Blockquote azul (opcional)
│ │ Adjuntamos la propuesta…       │  │
│ └────────────────────────────────┘  │
│                                     │
│    [ Ver en el portal ]             │  ← CTA primario
│    [ Descargar PDF ]                │  ← CTA secundario (opcional)
│                                     │
│ ─────────────────────────────────── │
│ TU EJECUTIVO DE CUENTA              │
│ Juan Pérez                          │
│ juan@librecarga.com · +52 55 …      │
│                                     │
│ Libre Carga · Ciudad de México      │  ← Footer estandarizado
│ Este correo es transaccional.       │
└─────────────────────────────────────┘
```

Props del layout: `{ documentType, folio, greeting, details, message?, ctas, ejecutivo?, footerNote? }`.

### 2. Tokens únicos en `_layout/tokens.ts`

Un solo lugar para colores, tipografía, radios y espaciados — hoy están triplicados. Analogía: la papelería de la empresa vive en una carpeta central, no en el escritorio de cada persona.

```ts
export const BRAND = { primary: '#1B2B4B', accent: '#2563EB', bg: '#F8FAFC', text: '#0F172A', muted: '#64748B', border: '#E2E8F0', hint: '#94A3B8' };
export const FONT = 'Inter, -apple-system, "Segoe UI", Arial, sans-serif';
```

### 3. Chips por tipo de documento (mismo layout, color distinto)

Diferenciador visual sutil que refuerza el tipo sin romper la consistencia:

- Cotización → chip azul acento (informativo)
- Proforma → chip ámbar (requiere acción)
- Factura → chip verde (documento fiscal emitido)

### 4. Header con logo `librecarga-logo.png`

Ya existe en `public/librecarga-logo.png`. Se sirve por URL pública absoluta desde el mismo dominio del portal para que los clientes de correo lo carguen (Gmail bloquea imágenes relativas). Fallback: texto "Libre Carga" si el logo no carga.

### 5. CTAs unificados

Reglas comunes: primario azul acento, secundario contorno azul marino, mismo tamaño en los 3 correos, mismo espaciado vertical.

- **Cotización**: primario "Ver cotización en el portal" · secundario "Descargar PDF"
- **Proforma**: primario "Revisar y responder proforma" · sin secundario (se añade línea explicativa)
- **Factura**: primario "Descargar PDF" · secundario "Descargar XML"

### 6. Footer estandarizado

Un solo string para los 3, con dos líneas: `Libre Carga · Correo transaccional.` + micro-línea legal opcional.

### 7. Preview text (línea de asunto secundario en la bandeja)

Estandarizada al patrón `{Tipo} {folio} — {contexto corto}` para que en la bandeja del cliente los tres correos "se vean como familia".

## Detalles técnicos

**Archivos nuevos** (dentro de `supabase/functions/_shared/transactional-email-templates/_layout/`):
- `tokens.ts` — colores, fuente, espaciados
- `styles.ts` — objetos de estilo compartidos (h1, lead, card, rowLabel, etc.)
- `EmailLayout.tsx` — shell con `Header`, `Container`, `Footer`
- `EmailChip.tsx` — chip de tipo de documento
- `EmailRow.tsx` — fila etiqueta/valor reutilizable
- `EmailFirma.tsx` — bloque de ejecutivo
- `EmailCta.tsx` — botones primario/secundario

**Archivos refactorizados** (mismo `template` export, mismas `Props`, mismo `subject`, mismo `previewData`):
- `cotizacion-enviada.tsx` — pasa de ~150 → ~70 líneas
- `proforma-enviada.tsx` — pasa de ~130 → ~65 líneas
- `factura-enviada.tsx` — pasa de ~145 → ~70 líneas

**No se toca**:
- `registry.ts`, el `send-transactional-email` edge function, ni los call-sites en la app.
- `cotizacion-respuesta.tsx` (correo interno al ejecutivo cuando el cliente responde — puede migrarse en un paso posterior si lo indicas).
- Templates de auth (`_shared/email-templates/`) — son otro flujo (Supabase auth hook) y no los mencionaste.

**Restricciones respetadas**:
- Body background `#ffffff` (regla de Lovable Emails).
- Sin `<style>` ni `dangerouslySetInnerHTML`.
- React Email components v0.0.22 ya en uso.
- `deploy_edge_functions` sobre `send-transactional-email` al terminar.

## Validación

1. Preview local con `previewData` de los 3 templates → capturar screenshots y comparar (deben verse como una familia).
2. Envío de prueba a mi correo desde el módulo de facturación / cotizaciones / proformas.
3. `CHANGELOG.md` + bump de `APP_VERSION` (patch).

## Alcance excluido

- No se agrega marketing, tracking pixels ni cross-sell.
- No se toca `cotizacion-respuesta.tsx` (interno) salvo que lo pidas.
- No se cambia el contenido literal de los mensajes (sólo estructura visual y consistencia).

¿Confirmas que aplique este rediseño a los 3 correos, o quieres que también incluya `cotizacion-respuesta.tsx` en el mismo paso?
