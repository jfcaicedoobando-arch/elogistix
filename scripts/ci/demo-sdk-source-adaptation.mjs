/** One reviewed import migration; historical source inventories remain unchanged. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const adapter = 'supabase/functions/demo-access/index.ts';
const previous = 'import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";';
const current = 'import { createClient } from "npm:@supabase/supabase-js@2.118.0";';

export function historicalDemoSourceBytes(path, bytes) {
  if (path !== adapter) return bytes;
  // Pin the complete migrated adapter before reversing its sole reviewed change.
  // A body/wiring change, another SDK version or an old adapter cannot pass.
  assert.equal(bytes.length, 1103, adapter);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '7b02a82e60e68706d71c7bb9932fabe2a2914cdba14b70c409a7edaf1071b3bd', adapter);
  const source = bytes.toString('utf8');
  assert.equal(source.split(current).length - 1, 1, 'Exact migrated SDK import required');
  assert.equal(source.includes(previous), false, 'Historical SDK import must be absent');
  return Buffer.from(source.replace(current, previous), 'utf8');
}
