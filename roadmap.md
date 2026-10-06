# Roadmap y seguimiento

Revisión documental: **2026-09-26**.

Este archivo no es una cola confirmada de bugs. Los lotes cerrados anteriores
están en Git/changelogs; las casillas antiguas “En curso” con todo marcado y
el bloqueo PPD + No objeto eran referencias superadas.

## Trabajo nuevo

- [x] Exigir empresa asociada en alta rápida y completa; guardado atómico sin cambiar históricos. 43 pruebas focalizadas, lint y prueba SQL aislada correctos; baseline regenerada. CI/RLS completos y db:postcheck quedan pendientes de GitHub Actions, conforme a la política de validación local.

- [x] Oportunidades CRM: margen esperado sin cero fijo y etiquetas actualizadas; 26 pruebas focalizadas y lint de archivos modificados correctos. CI/RLS completos quedan en GitHub Actions.

Registrar cada iniciativa aprobada en un issue/PR o diagnóstico con:
ID, evidencia/fecha/entorno, prioridad, alcance, responsable y criterio
observable de cierre. Verificar el código/deploy actual antes de reabrir
un hallazgo de una auditoría vieja.

Una recomendación de diagnóstico no es autorización de implementación.
Merge, pruebas, deploy backend y publicación se registran por separado.

## Evidencia que no se cerró con esta limpieza

- [Pendientes históricos por verificar](docs/auditoria/pendientes-historicos.md).
- [Riesgos aceptados](docs/riesgos-aceptados.md).
- [Divergencias replay-mirror](docs/ola14-replay-mirror-saldo.md).
- [.env / higiene](docs/ops/purga-env-git.md).

Retirar un plan Markdown no demuestra que se hayan corregido todos sus
datos ni autoriza aplicar migraciones/ajustes propuestos.

## CRM por objetos (plan aprobado 2026-10-01)
- [x] Fase 1: base de objetos, vínculos, propiedades y migración de datos (preparada, se aplica al aceptar el draft)
- [x] Fase 2: pantallas de Empresas y Contactos + vínculos en Oportunidad (actividades sin vínculo desde ficha aún)
- [x] Fase 3: módulo de Propiedades (super admin) + propiedades iniciales + captura en fichas
- [x] Fase 4: embudo de 7 etapas
- [x] Fase 5 — Solicitud a Pricing
- [x] Fase 6 — Puntaje A/B/C
- [x] Fase 7: reportes dinámicos
