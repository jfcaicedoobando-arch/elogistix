# Corregir prueba de arquitectura: literal de color en Oportunidades

## Qué falla

La prueba `no-legacy-color-literals` bloquea el CI porque `src/features/crm/routes/Oportunidades.tsx` línea 79 usa el literal de Tailwind `text-amber-600 dark:text-amber-400` en el aviso de "lista truncada", en lugar de un token semántico del design system.

## Cambio propuesto

Reemplazar el literal por el token semántico de advertencia ya existente en el sistema (`text-warning`), que funciona igual en modo claro y oscuro:

```
<p className="text-label text-warning">
```

Sin cambios de lógica ni de texto; solo el color pasa a token.

## Verificación

- Correr la prueba de arquitectura de literales de color.
- Correr lint, tipos y las pruebas del módulo CRM.

## Registro

- Bump de `APP_VERSION` (patch) y entrada breve en `CHANGELOG.md`.
