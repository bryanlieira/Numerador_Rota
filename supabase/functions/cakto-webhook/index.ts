import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EVENTOS_QUE_ATIVAM = [
  "purchase_approved",
  "subscription_renewed",
  "subscription_created",
];
const EVENTOS_QUE_DESATIVAM = [
  "refund",
  "chargeback",
  "subscription_canceled",
  "purchase_refused",
  "subscription_renewal_refused",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate Cakto secret (field in JSON body)
    if (body.secret !== Deno.env.get("CAKTO_WEBHOOK_SECRET")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evento: string = body.event ?? "";
    const email: string | undefined = body?.data?.customer?.email;

    if (!email) {
      return new Response(JSON.stringify({ error: "email ausente no payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optional: confirm order via Cakto API for extra security
    const orderId: string | undefined = body?.data?.order?.id ?? body?.data?.id;
    if (orderId && EVENTOS_QUE_ATIVAM.includes(evento)) {
      const clientId = Deno.env.get("CAKTO_CLIENT_ID");
      const clientSecret = Deno.env.get("CAKTO_CLIENT_SECRET");
      if (clientId && clientSecret) {
        try {
          const tokenRes = await fetch("https://api.cakto.com.br/public_api/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
          });
          if (tokenRes.ok) {
            const { access_token } = await tokenRes.json();
            const orderRes = await fetch(
              `https://api.cakto.com.br/public_api/orders/${orderId}/`,
              { headers: { Authorization: `Bearer ${access_token}` } }
            );
            if (orderRes.ok) {
              const order = await orderRes.json();
              if (order.status !== "approved" && order.status !== "paid") {
                return new Response(JSON.stringify({ error: "pedido nao confirmado na cakto" }), {
                  status: 402,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }
        } catch {
          // If confirmation fails due to network, fall through and trust the secret
        }
      }
    }

    if (EVENTOS_QUE_ATIVAM.includes(evento)) {
      await supabase
        .from("profiles")
        .update({
          subscription_active: true,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("email", email);
    } else if (EVENTOS_QUE_DESATIVAM.includes(evento)) {
      await supabase
        .from("profiles")
        .update({ subscription_active: false, expires_at: null })
        .eq("email", email);
    }
    // All other events (pix_gerado, checkout_abandonment, etc.) — no action needed

    return new Response(JSON.stringify({ ok: true, evento, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
