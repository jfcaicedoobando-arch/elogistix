import assert from 'node:assert/strict';
import fixtures from './cxcInputValidation.fixtures.json' with { type: 'json' };
import { BodySchema as estado } from '../cxc-estado-cuenta-enviar/bodySchema.ts';
import { BodySchema as recordatorio } from '../cxc-recordatorio-enviar/bodySchema.ts';
import { cxcValidationError } from './cxcInputValidation.ts';

Deno.test('CxC: Zod 4 preserves the 30 request/data/error fixtures captured from Zod 3', () => {
  const schemas = { estado, recordatorio };
  for (const fixture of fixtures.cases) {
    const schema = schemas[fixture.schema as keyof typeof schemas];
    const parsed = schema.safeParse(fixture.body, { error: cxcValidationError });
    const actual = parsed.success
      ? { success: true, data: parsed.data }
      : { success: false, details: parsed.error.flatten().fieldErrors };
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), fixture.expected, fixture.name);
  }
});
