import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EVENTOS_QUE_ATIVAM = new Set([
  "payment_approved",   // Cakto one-time purchase
  "purchase_approved",  // alias used in some Cakto plans
  "subscription_created",
  "subscription_renewed",
]);

const EVENTOS_QUE_DESATIVAM = new Set([
  "refund",
  "chargeback",
  "subscription_canceled",
  "purchase_refused",
  "subscription_renewal_refused",
]);

Deno.serve(async (req: Request) => {
  console.log(`[cakto-webhook] ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[cakto-webhook] payload recebido:", JSON.stringify(body));

    // ── 1. Validar secret ──────────────────────────────────────────────────
    const webhookSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[cakto-webhook] CAKTO_WEBHOOK_SECRET não configurado");
      return new Response(JSON.stringify({ error: "server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.secret !== webhookSecret) {
      console.warn("[cakto-webhook] secret inválido recebido");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[cakto-webhook] secret validado OK");

    // ── 2. Extrair dados do payload ────────────────────────────────────────
    const evento: string = body.event ?? "";
    const email: string | undefined =
      body?.data?.customer?.email ?? body?.data?.email;

    console.log(`[cakto-webhook] evento="${evento}" email="${email}"`);

    if (!email) {
      console.error("[cakto-webhook] email ausente no payload");
      return new Response(JSON.stringify({ error: "email ausente no payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Confirmar pedido na API Cakto (opcional, se credenciais disponíveis) ──
    const orderId: string | undefined =
      body?.data?.order?.id ?? body?.data?.id;
    if (orderId && EVENTOS_QUE_ATIVAM.has(evento)) {
      const clientId = Deno.env.get("CAKTO_CLIENT_ID");
      const clientSecret = Deno.env.get("CAKTO_CLIENT_SECRET");
      if (clientId && clientSecret) {
        try {
          console.log(`[cakto-webhook] confirmando pedido ${orderId} na API Cakto`);
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
              console.log(`[cakto-webhook] status do pedido na Cakto: ${order.status}`);
              if (order.status !== "approved" && order.status !== "paid") {
                console.warn("[cakto-webhook] pedido não confirmado — abortando ativação");
                return new Response(JSON.stringify({ error: "pedido nao confirmado na cakto", status: order.status }), {
                  status: 402,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }
        } catch (confirmErr) {
          // Network failure → fall through and trust the secret
          console.warn("[cakto-webhook] falha ao confirmar na API Cakto, prosseguindo:", confirmErr);
        }
      }
    }

    // ── 4. Atualizar subscription no Supabase ──────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (EVENTOS_QUE_ATIVAM.has(evento)) {
      console.log(`[cakto-webhook] ativando assinatura para ${email}`);
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_active: true,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("email", email);
      if (error) {
        console.error("[cakto-webhook] erro ao ativar:", error.message);
        throw new Error(error.message);
      }
      console.log(`[cakto-webhook] assinatura ATIVADA para ${email}`);

    } else if (EVENTOS_QUE_DESATIVAM.has(evento)) {
      console.log(`[cakto-webhook] desativando assinatura para ${email}`);
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_active: false, expires_at: null })
        .eq("email", email);
      if (error) {
        console.error("[cakto-webhook] erro ao desativar:", error.message);
        throw new Error(error.message);
      }
      console.log(`[cakto-webhook] assinatura DESATIVADA para ${email}`);

    } else {
      console.log(`[cakto-webhook] evento "${evento}" ignorado — nenhuma ação necessária`);
    }

    return new Response(JSON.stringify({ ok: true, evento, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[cakto-webhook] erro interno:", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
