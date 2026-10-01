# Decisiones técnicas

- CRM por objetos: lecturas y vínculos de Empresas/Contactos viven en `src/features/crm/services/objetosCrm.ts` y `vinculosCrm.ts`; las pantallas usan `VinculosCard` para ligar/desligar, y quitar un vínculo nunca borra el registro. Why: un solo lugar para el modelo muchos-a-muchos.
- CRM propiedades: definiciones en `services/propiedadesCrm.ts`, valores EAV en `services/valoresCrm.ts`; renombrar una opción crea otra con `reemplaza_a` y archiva la anterior, y la pantalla resuelve el nombre vigente con `idVigente`/`etiquetaVigente`. Why: los valores viejos nunca se reescriben.
