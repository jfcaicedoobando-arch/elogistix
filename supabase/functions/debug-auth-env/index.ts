// Diagnóstico temporal: reporta si las llaves de entorno existen (sin exponer valores).
declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (r: Request) => Promise<Response>) => void };

Deno.serve(async (req: Request) => {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const authHeader = req.headers.get("Authorization") ?? "";
  let remote = "no-token";
  if (authHeader.startsWith("Bearer ") && url) {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey ?? "" },
    });
    const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const r2 = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: sr },
    });
    remote = `anon=${r.status}:${(await r.text()).slice(0, 200)} service=${r2.status}:${(await r2.text()).slice(0, 200)} url=${url}`;
  }
  return new Response(
    JSON.stringify({
      has_anon: !!anonKey,
      anon_len: anonKey?.length ?? 0,
      has_url: !!url,
      remote_user_status: remote,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
