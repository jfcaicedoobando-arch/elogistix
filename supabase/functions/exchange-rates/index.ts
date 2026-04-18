import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=MXN&to=USD,EUR");
    const data = await res.json();

    // frankfurter gives MXN→USD and MXN→EUR, we need inverse
    const usdMxn = data.rates?.USD ? +(1 / data.rates.USD).toFixed(4) : 17.25;
    const eurMxn = data.rates?.EUR ? +(1 / data.rates.EUR).toFixed(4) : 18.50;

    return jsonResponse({ usdMxn, eurMxn });
  } catch {
    return jsonResponse({ usdMxn: 17.25, eurMxn: 18.50 });
  }
});
