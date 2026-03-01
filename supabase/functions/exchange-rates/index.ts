const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=MXN&to=USD,EUR");
    const data = await res.json();

    // frankfurter gives MXN→USD and MXN→EUR, we need inverse
    const usdMxn = data.rates?.USD ? +(1 / data.rates.USD).toFixed(4) : 17.25;
    const eurMxn = data.rates?.EUR ? +(1 / data.rates.EUR).toFixed(4) : 18.50;

    return new Response(JSON.stringify({ usdMxn, eurMxn }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ usdMxn: 17.25, eurMxn: 18.50 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
