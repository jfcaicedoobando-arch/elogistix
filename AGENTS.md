# Decisiones técnicas

- CRM por objetos: lecturas y vínculos de Empresas/Contactos viven en `src/features/crm/services/objetosCrm.ts` y `vinculosCrm.ts`; las pantallas usan `VinculosCard` para ligar/desligar, y quitar un vínculo nunca borra el registro. Why: un solo lugar para el modelo muchos-a-muchos.
