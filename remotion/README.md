# Remotion — video de presentación

Subproyecto independiente del frontend ERP. Su `package.json` tiene dependencias
propias: no asumir que usa las versiones React/TypeScript del paquete raíz.

El entry de composiciones está en `remotion/src/index.ts`, registradas en `remotion/src/Root.tsx`.
`index.ts` raíz sólo imprime un saludo; no genera el video.

Desde esta carpeta:

```bash
bun install --frozen-lockfile
bunx remotion studio src/index.ts
```

Para render consultar composiciones/props y `bunx remotion --help`.
No generar video, actualizar dependencias o cambiar configuración como efecto
secundario de mantener documentación. Revisado el 2026-09-26.
