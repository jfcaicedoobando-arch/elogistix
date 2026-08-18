# `src/lib/domain`

Reglas de dominio **cross-cutting**: las consumen dos o más features (o código
compartido en `src/components`, `src/hooks`, `src/services`, `src/pdf`).

Si una regla la usa un solo feature, va en `src/features/<feature>/domain/`.
El guardrail `src/__tests__/architecture/lib-domain-es-cross-cutting.test.ts`
falla si un módulo de esta carpeta queda con un único feature consumidor.
