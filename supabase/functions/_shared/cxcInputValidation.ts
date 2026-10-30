import { z } from 'npm:zod@4.6.7';

// Preserve the JSON request language accepted by the former Zod 3.23.8 schemas.
// In particular, persisted GUIDs need not carry RFC UUID version/variant bits.
const UUID3 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const EMAIL3 = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

export const cxcGuid = () => z.string().regex(UUID3, 'Invalid uuid');
export const cxcEmail = () => z.string().regex(EMAIL3, 'Invalid email');

function receivedType(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  if (typeof input === 'number' && Number.isNaN(input)) return 'nan';
  return typeof input;
}

// Per-parse mapping: other Edge validators retain their own error policy.
export const cxcValidationError: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_type') {
    return issue.input === undefined
      ? 'Required'
      : `Expected ${issue.expected}, received ${receivedType(issue.input)}`;
  }
  if (issue.code === 'too_big' && issue.origin === 'string') {
    return `String must contain at most ${issue.maximum} character(s)`;
  }
  if (issue.code === 'invalid_value' && issue.values.length === 1 && issue.values[0] === 'email') {
    if (issue.input === undefined) return 'Required';
    return typeof issue.input === 'string'
      ? `Invalid enum value. Expected 'email', received '${issue.input}'`
      : `Expected 'email', received ${receivedType(issue.input)}`;
  }
  return undefined;
};
