# Diagnóstico: versión real del runtime Deno/Edge desplegado (solo lectura, ya ejecutado)

Consulta operativa de diagnóstico. No se cambió código, dependencias, migraciones, datos, versión, secretos ni se publicó nada. Versión sigue 13.824.14.

## Consulta realizada (1, enfocada)

- Estado del backend en la nube: activo y saludable (auth y base de datos responden). No expone versión de runtime.

## Resultado: NO dispongo de herramienta oficial que identifique la versión Deno/Edge Runtime real desplegada

Verificado contra las capacidades disponibles:

1. **Logs de Edge Functions** (ya en contexto, sin consulta nueva): el raw Boot de `exchange-rates` de hoy solo contiene `booted (time: 40ms)`, `event_type`, `function_id`, `id`, `log_level` y `timestamp`. **Sin versión** — coincide con lo que Codex ya observó.
2. **Estado del backend en la nube**: reporta salud y latencias de auth/base de datos; no expone versión de Deno ni de Edge Runtime.
3. **Herramientas de proyecto/funciones** (info, linter, logs, despliegue): ninguna devuelve la versión del runtime remoto.
4. El repo no expone `Deno.version` y no se puede ejecutar una función para sondearlo (prohibido y además sería escritura de log).

**Conclusión: es una limitación de la plataforma, no un bug del ERP.** La versión del runtime remoto la administra Lovable Cloud/Supabase y no es observable desde ninguna herramienta oficial de solo lectura disponible en este entorno.

## Vía oficial del proveedor para verificarla

- **Soporte de Lovable** (chat de ayuda en la app o soporte oficial): solicitar la versión de Deno/Edge Runtime del proyecto. Es la única vía oficial que certifica el runtime remoto.
- Referencia de compatibilidad ya documentada en `docs/ops/ci.md`: Sentry 11.4.0 exige Deno >= 2.8.3; el CLI 2.9.7 de Actions no certifica el runtime remoto (ya asentado por Codex).

## Sin acciones pendientes de mi lado

No hay nada que implementar en el proyecto. No inferí versión de YAML, package.json, CLI local ni de HTTP 200/booted.
