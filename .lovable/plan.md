
## Auditoría del modal "Enviar factura por correo"

Archivo: `src/components/shared/emails/EnviarDocumentoDialog.tsx` (compartido con cotización/proforma).

### Incongruencias detectadas

1. **Dos patrones distintos para lo mismo (agregar un email):**
   - *Destinatarios manuales*: input + botón "Agregar" → produce un `Badge` por correo con "x" para quitar.
   - *CC*: un solo `Input` de texto libre "emails adicionales separados por coma". El usuario logueado aparece como badge readonly aparte. No hay chips, no hay validación visible, no se puede quitar uno individual sin editar la cadena.

2. **Feedback de validación desigual:**
   - En destinatarios el botón se desactiva si el email es inválido y hay `Enter` para agregar.
   - En CC no hay validación en vivo; se parsea sólo al enviar. No queda claro qué se está por enviar.

3. **Jerarquía visual confusa:**
   - "Destinatarios" mezcla en el mismo bloque: contactos con checkboxes, badges de manuales, e input de "agregar manual". Cuando el cliente no tiene contactos, el input queda pegado a un mensaje informativo sin separación.
   - "Recientes" (chips sugeridos) sólo existe en proforma (`DestinatariosRecientesChips`), no se aprovecha aquí.

4. **Usuario logueado como CC "fantasma":**
   - Se muestra como badge `(tú)` pero no se puede quitar ni se refleja en el input. No queda claro si es obligatorio.

5. **Sin distinción visual entre contactos del cliente vs. manuales** una vez agregados: los manuales viven en badges arriba del input; los del cliente quedan como checkboxes. Al enviar, todos son "destinatarios" pero la UI los trata como dos mundos.

6. **Espaciado / uso del ancho** (`size="2xl"`): la sección de CC se ve pobre (un input flaco); destinatarios ocupa mucho vertical con la lista completa aunque sean 1-2 contactos.

---

## Propuesta de rediseño (sólo UI/UX, sin cambios de backend)

Unificar destinatarios y CC bajo **un mismo componente de "campo tipo etiquetas"** (chip input), como Gmail/Outlook. Cambios:

### 1. Nuevo componente compartido `EmailChipsField`

Un campo reutilizable que muestre chips + input inline:
- Input al final del contenedor, `Enter`, `,`, `;` o `Tab` confirman el chip.
- Backspace en input vacío elimina el último chip.
- Cada chip tiene "×" y tooltip con el correo completo.
- Validación en vivo: chip inválido en `destructive` con tooltip "correo inválido".
- Soporta pegar lista separada por comas (auto-split).
- Prop `readonlyChips` para el correo del usuario logueado (chip con candado, no removible) y prop `suggestedChips` para "Recientes".
- Prop `sourceLabel` opcional para colorear chips que vienen de contactos del cliente vs. manuales (badge chico "cliente" / "manual").

### 2. Rediseño del modal (`EnviarDocumentoDialog.tsx`)

```
┌─ Enviar factura ─────────────────────────────┐
│ Para *                                        │
│  ┌─────────────────────────────────────────┐ │
│  │ [Ana Pérez · principal ×] [otro@x.com ×]│ │
│  │ [escribe un correo o elige abajo…____ ] │ │
│  └─────────────────────────────────────────┘ │
│  Contactos del cliente:                       │
│   ☑ Ana Pérez · principal   ana@x.com         │
│   ☐ Juan · operativo         juan@x.com       │
│  Recientes: [maria@x.com +] [pagos@x.com +]   │
│                                               │
│ CC                                            │
│  ┌─────────────────────────────────────────┐ │
│  │ [🔒 yo@empresa.com] [copia@x.com ×] [__]│ │
│  └─────────────────────────────────────────┘ │
│                                               │
│ Asunto                                        │
│ Mensaje (opcional)                            │
│ ☐ Marcar el documento como Enviado            │
└───────────────────────────────────────────────┘
```

- **Para** y **CC** usan el mismo componente → misma interacción, mismo look.
- Los checkboxes de contactos del cliente ahora sólo **agregan/quitan chips en el campo "Para"** (los chips son la fuente de verdad; el check refleja si el email de ese contacto está presente).
- Chips de contactos muestran un mini-badge con el tipo (`principal`, `facturacion`, `operativo`).
- El usuario logueado en CC es un chip con candado (no removible), no un badge "fuera del campo".
- Se agrega la fila "Recientes" (reusando `DestinatariosRecientesChips` para facturas también) — click agrega el chip.

### 3. Ajustes de layout menores

- Reducir `size` del dialog a `xl` en desktop (2xl era necesario porque el input de CC quedaba solitario; con chips ya no hace falta tanto ancho).
- Sección de checkboxes de contactos: colapsable si hay >4, y ocultar sección completa si el cliente no tiene contactos (evita el "input flotante" incongruente).
- Añadir contador `N destinatarios · M en copia` arriba del footer para dar confianza antes de enviar.

### 4. Sin cambios en:

- `useEnvioDocumentoForm` API pública (mantiene `seleccionados`, `emailsManualesAgregados`, `ccManual`, `destinatarios`, `ccEmails`). Internamente `ccManual` seguirá siendo string separado por comas — el nuevo `EmailChipsField` lo serializa/parsea.
- Edge functions ni contratos de payload.
- Memoria de destinatarios (`useDestinatariosSugeridos`).

---

## Archivos que se tocarían (cuando implementemos)

- **Nuevo:** `src/components/shared/emails/EmailChipsField.tsx`
- **Editado:** `src/components/shared/emails/EnviarDocumentoDialog.tsx` (rediseño interno).
- **Editado:** `src/components/shared/emails/DestinatariosPicker.tsx` — se recorta a "lista de contactos con checkboxes" (los manuales dejan de vivir aquí).
- Reutilizar `src/features/proformas/components/DestinatariosRecientesChips.tsx` también para facturas (pasar como prop).
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

### Detalle técnico (no visible al usuario)

- `EmailChipsField` es un `input`-container con `role="group"` + `aria-label`. Chips son botones focusables con `aria-label="quitar <email>"`. Cumple accesibilidad teclado (Tab entre chips, Backspace elimina).
- Validación con `EMAIL_RE` existente.
- Sin nuevas dependencias.
- Componentes ≤200 líneas (Power of 10 #4). Si `EnviarDocumentoDialog` crece, extraer secciones a `EnviarDocumentoDialog.Para.tsx` / `.CC.tsx`.

---

¿Procedo a implementarlo tal cual, o quieres afinar algo (por ejemplo: mantener los checkboxes de contactos separados del campo de chips, o preferir que el usuario logueado en CC sí sea removible)?
