import { ROLE_ROUTE_MATRIX } from "@/lib/access/roleRouteMatrix";
import { anyRoleSatisfies } from "@/lib/auth/roleHierarchy";
import { ROLE_EQUIVALENTS } from "@/lib/auth/roleHierarchy";
const roles = Object.keys(ROLE_EQUIVALENTS) as (keyof typeof ROLE_EQUIVALENTS)[];
const diffs: string[] = [];
for (const [path, allowed] of Object.entries(ROLE_ROUTE_MATRIX)) {
  for (const r of roles) {
    const a = allowed.includes(r);
    const b = anyRoleSatisfies(allowed, r);
    if (a !== b) diffs.push(`${path} ${r} includes=${a} jerarquia=${b}`);
  }
}
console.log(diffs.length); console.log(diffs.join("\n"));
