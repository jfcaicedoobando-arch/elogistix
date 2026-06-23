## Refresh UI/UX del modal "Nuevo Usuario"

### Diagnóstico
El modal funciona pero tiene un bug visual y varias oportunidades de pulido.

**Bug crítico** — `NuevoUsuarioDialog.tsx:147-152`
El `SelectItem` del rol contiene un `<div flex-col>` con título + descripción. Cuando Radix pinta el valor seleccionado dentro del `SelectTrigger`, ese mismo nodo se renderiza y desborda en vertical (se ve "Atención a Clientes" flotando arriba del trigger y la descripción cortada). Además, abajo se repite la descripción en un `<p>` con `bg-muted/40` → **doble pintura** de la misma info.

**Otros pain points**
- Layout 100% vertical → modal alto en pantallas chicas, ancho desperdiciado en desktop.
- Contraseña: regla "min 6" + sin generador ni medidor → admin tiene que inventar pw y dictarla.
- No hay opción de enviar invitación por correo (workflow más profesional).
- Sin auto-focus en Email al abrir.
- Sin preview/avatar del usuario que se crea (inconsistente con la tabla nueva).
- Header pequeño, sin jerarquía visual fuerte.

### Cambios propuestos

**1. Fix del SelectTrigger (sin perder la descripción rica en el dropdown)**
- `SelectItem` sigue mostrando título + descripción en el menú (bueno para elegir).
- `SelectValue` recibe un **render personalizado** que sólo muestra el `ROLE_LABELS[role]` + badge de color del rol (`ROLE_BADGE_CLASSES`).
- Se elimina el `<p>` duplicado de abajo y se reemplaza por una **tarjeta de preview** del rol seleccionado (descripción + 2-3 capacidades clave) que vive en la columna derecha — más útil que el `<p>` plano.
- Se acota el `SelectContent` con `w-[var(--radix-select-trigger-width)]` o ancho fijo razonable para que el dropdown no explote.

**2. Layout 2 columnas en desktop**
```text
┌─────────────────────────────────────────────────┐
│ 👤  Nuevo Usuario                            ×  │
│ Registra un usuario y asígnale un rol.          │
├──────────────────────┬──────────────────────────┤
│ CREDENCIALES         │ ACCESO                   │
│ ✉ Email              │ 🛡 Rol                   │
│ [usuario@...      ]  │ [Atención a Clientes ▾]  │
│                      │                          │
│ 🔒 Contraseña        │ ┌─ Vista previa rol ──┐ │
│ [••••••• ] [👁][🎲]  │ │ 🟦 Atención Clientes│ │
│ ●●●○○ Buena          │ │ Solo lectura...     │ │
│ □ Enviar invitación  │ │ • Embarques: ver    │ │
│   por correo         │ │ • CRM: sin acceso   │ │
│                      │ └─────────────────────┘ │
├──────────────────────┴──────────────────────────┤
│                       [Cancelar] [Crear usuario]│
└─────────────────────────────────────────────────┘
```
- En `sm` y abajo: vuelve a 1 columna (`md:grid-cols-2`).
- Modal pasa de `dialogSize.md` a `dialogSize.lg` (más ancho para que las 2 columnas respiren).

**3. Contraseña con generador + medidor**
- Botón **🎲 Generar** (icono `Dice5`) al lado del 👁: genera password fuerte de 12 chars (mayúsculas + minúsculas + números + símbolo). Implementación en `lib/passwords/generator.ts` (~30 líneas, fácilmente testeable).
- **Medidor de fuerza** (4 niveles: débil/aceptable/buena/fuerte) basado en heurística simple: longitud + variedad de charsets. Renderizado con 4 barritas de color (`bg-destructive/bg-warning/bg-info/bg-success`).
- Sube el mínimo de **6 a 8 caracteres** (validación y placeholder).

**4. Vista previa del rol (reemplaza el `<p>` duplicado)**
- Card con borde + bg-muted/30:
  - Badge del rol (mismo `ROLE_BADGE_CLASSES`).
  - Descripción completa (`ROLE_DESCRIPTIONS[role]`).
- Vive en la columna derecha bajo el select.

**5. Header con más jerarquía**
- Icono 5×5 → **icon-tile** (10×10 con bg-primary/10, primary text), estilo consistente con otros modales del ERP.
- Border-bottom debajo del header + padding generoso.

**6. Quality-of-life**
- `autoFocus` en input Email.
- Pulsar Enter en cualquier campo dispara submit (ya lo hace por ser `<form>`, verificar).
- Footer con `border-t pt-4` para separación visual.
- Loading state: el botón "Crear usuario" muestra spinner + texto "Creando…" (hoy ya tiene spinner pero conserva texto).

### Archivos a tocar
- `src/features/admin/components/usuario/NuevoUsuarioDialog.tsx` — layout 2 col, fix SelectValue, card preview del rol, header con icon-tile.
- `src/features/admin/components/usuario/NuevoUsuarioCredencialesSection.tsx` — botón generar pw + medidor de fuerza, min 8.
- `src/lib/passwords/generator.ts` (nuevo) — `generarPassword(length=12)` + `evaluarFuerza(pw)` → `{ score: 0-4, label }`. ~50 líneas, con test unitario.
- `src/lib/passwords/__tests__/generator.test.ts` (nuevo) — 4-5 casos.
- `src/constants/appVersion.ts` — bump `13.118.5`.
- `CHANGELOG.md` — entrada describiendo el refresh.

### Lo que NO cambia
- Hook `useCreateUser`, servicio, edge function `user-management` — intactos.
- Validaciones de email/RLS, lista de roles asignables, defaults — iguales.
- Selector de organización (`showOrgSelector`) sigue arriba del select de rol, sin cambios funcionales.
- No se implementa "enviar invitación por correo" en esta vuelta (requiere edge function + plantilla — propongo dejarlo para una iteración aparte). Se deja la UX preparada visualmente para que en el futuro un radio "Asignar contraseña ahora" / "Enviar invitación" sea natural.

### Notas técnicas
- El fix del `SelectValue` es lo más urgente — es un bug, no sólo estética.
- El generador de pw es **client-side puro**: usa `crypto.getRandomValues` (Web Crypto API, disponible en navegadores modernos).
- Medidor de fuerza es heurística simple, no zxcvbn (evitamos sumar dependencia de 800kb por algo que no necesita ser perfecto).
- No se introducen nuevas dependencias.

### Opcional: design directions visuales
Si prefieres ver **3 variantes visuales** rendereadas antes de decidir (split horizontal vs vertical, intensidad del rol-preview, posición del medidor de pw, etc.), confirma y llamo a `design--create_directions` con la captura del modal actual.
