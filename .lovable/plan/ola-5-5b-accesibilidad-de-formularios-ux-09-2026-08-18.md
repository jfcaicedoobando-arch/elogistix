# Ola 5 + 5b — Accesibilidad de formularios (UX-09)

## Problema

Los lectores de pantalla no anuncian el nombre de muchos campos: un `<Input>` sin `id` ligado a su `<Label htmlFor>` (ni `aria-label`) se oye como "cuadro de edición" y nada más. Es como un archivero con cajones sin etiqueta: quien ve la pantalla adivina por el contexto, quien la escucha no.

Hoy hay 386 usos de `<Input` en `src/features` (170 archivos) y la mayoría no tiene etiqueta accesible asociada. Ya existe el componente correcto para resolverlo (`src/components/shared/FormField.tsx`, que genera el `id` con `useId`, liga `htmlFor` y conecta el error con `aria-describedby`) y su prueba de accesibilidad.

## Qué se hará

**Ola 5 — Migrar los formularios más visibles (28 inputs, tope 40)**

- Administración: seguridad global, alta de organización y edición en línea de planes.
- Configuración: navieras, puertos, tipos de contenedor, tipo de cambio DOF, operaciones, empresa, y el paso de API keys del asistente.

Tres patrones, según el caso:
1. Campo con etiqueta visible → se envuelve en `FormField` (las ayudas pasan a la prop `hint`).
2. Control sin etiqueta visible (celdas de tabla, barras de herramientas) → `aria-label` descriptivo.
3. Etiqueta compuesta (texto + insignias) o control que no es el primer hijo → `Label htmlFor` + `id` explícito en kebab-case con prefijo del módulo.

Sin cambios de comportamiento ni de diseño: mismos textos, mismo layout.

**Ola 5b — Guardrail en el linter para que no vuelva a crecer**

- Se agrega un bloque `a11y-input-label` en `eslint.config.js` que marca `<Input>` sin `id` ni `aria-label`, en nivel **warn** y limitado a `src/features/**`.
- Nivel warn a propósito: en "error" el lint fallaría de inmediato por la deuda existente. El bloque documenta el burn-down: cuando el conteo llegue a 0, subir a "error" y ampliar a `src/**`.
- No se instala `eslint-plugin-jsx-a11y` (no está en el proyecto): se usa `no-restricted-syntax` con selector, y el comentario deja anotada la migración futura a `jsx-a11y/control-has-associated-label`.

## Detalles técnicos

- Bloque nuevo al final de `eslint.config.js`, con `name: "a11y-input-label"` y `files: ["src/features/**/*.{ts,tsx}"]`; selector esquery sobre `JSXOpeningElement[name.name='Input']` negando `id` y `aria-label`.
- `FormField` inyecta `id` solo en el primer hijo elemento y solo si no trae uno, así que no se debe pasar `id` manual al migrar.
- El `Select` del alta de organización queda con `Label htmlFor` + `SelectTrigger id`, porque el control no es un `Input`.

## Verificación

- `bun run lint` (0 errores; los nuevos avisos son la deuda conocida), tipos, `audit:arch` y `audit:tests`.
- Suite de pruebas de los módulos tocados (admin y configuración) más `FormField.a11y.test.tsx`.
- Bump de `APP_VERSION` a 13.670.0 y entrada en `CHANGELOG.md`.
