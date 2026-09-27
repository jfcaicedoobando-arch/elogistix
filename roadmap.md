# Roadmap y seguimiento

Revisión documental: **2026-09-26**.

Este archivo no es una cola confirmada de bugs. Los lotes cerrados anteriores
están en Git/changelogs; las casillas antiguas “En curso” con todo marcado y
el bloqueo PPD + No objeto eran referencias superadas.

## Trabajo nuevo

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
