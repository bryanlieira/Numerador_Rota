import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Plan detection ────────────────────────────────────────────────────────────
function detectPlan(body: Record<string, any>): { plan_type: string; days: number | null } {
  const offerName: string = (
    body?.data?.offer?.name ??
    body?.data?.product?.name ??
    body?.offer?.name ??
    body?.product?.name ??
    ""
  ).toLowerCase();

  console.log(`[cakto-webhook] detectando plano a partir de: "${offerName}"`);

  if (offerName.includes("vitalic") || offerName.includes("lifetim") || offerName.includes("vitalício")) {
    return { plan_type: "vitalicio", days: null };
  }
  if (offerName.includes("anual") || offerName.includes("annual") || offerName.includes("ano")) {
    return { plan_type: "anual", days: 365 };
  }
  if (offerName.includes("trimest") || offerName.includes("3 mes") || offerName.includes("3mes") || offerName.includes("quarter")) {
    return { plan_type: "trimestral", days: 90 };
  }
  if (offerName.includes("seман") || offerName.includes("semana") || offerName.includes("week")) {
    return { plan_type: "semanal", days: 7 };
  }
  // Default → mensal
  return { plan_type: "mensal", days: 30 };
}

Deno.serve(async (req: Request) => {
  console.log(`[cakto-webhook] ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[cakto-webhook] raw body:", rawBody);

    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[cakto-webhook] body não é JSON válido");
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Validar secret (se configurado) ───────────────────────────────────
    const webhookSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const receivedSecret: string | undefined =
        body.secret ?? body.token ?? body.webhook_token;
      if (receivedSecret !== webhookSecret) {
        console.warn("[cakto-webhook] secret inválido — recebido:", receivedSecret);
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[cakto-webhook] secret validado OK");
    } else {
      console.warn("[cakto-webhook] CAKTO_WEBHOOK_SECRET não configurado — sem validação de secret");
    }

    // ── 2. Extrair evento e email ─────────────────────────────────────────────
    const evento: string = (body.event ?? body.type ?? "").toLowerCase();
    const email: string | undefined = (
      body?.data?.customer?.email ??
      body?.data?.buyer?.email ??
      body?.customer?.email ??
      body?.buyer?.email ??
      body?.email
    );

    console.log(`[cakto-webhook] evento="${evento}" email="${email ?? "NÃO ENCONTRADO"}"`);

    if (!email) {
      console.error("[cakto-webhook] FALHA: email ausente no payload");
      return new Response(JSON.stringify({ error: "email ausente no payload", body }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Decidir ação ───────────────────────────────────────────────────────
    const eventosQueAtivam = new Set([
      "payment_approved", "purchase_approved", "approved", "paid",
      "subscription_created", "subscription_renewed", "subscription_renewal",
      "", // ping sem evento → ativar
    ]);
    const eventosQueDesativam = new Set([
      "refund", "chargeback", "subscription_canceled", "subscription_cancelled",
      "purchase_refused", "subscription_renewal_refused", "cancelled", "canceled",
    ]);

    let acao: "ativar" | "desativar" | "ignorar";
    if (eventosQueAtivam.has(evento)) {
      acao = "ativar";
    } else if (eventosQueDesativam.has(evento)) {
      acao = "desativar";
    } else {
      acao = "ignorar";
      console.log(`[cakto-webhook] evento "${evento}" ignorado`);
      return new Response(JSON.stringify({ ok: true, acao, evento }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[cakto-webhook] ação: ${acao}`);

    // ── 4. Buscar perfil pelo email ───────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[cakto-webhook] buscando perfil para email="${email}"...`);
    const { data: perfil, error: selectErr } = await supabase
      .from("profiles")
      .select("id, email, subscription_active, plan_type, subscription_expires_at")
      .eq("email", email)
      .maybeSingle();

    if (selectErr) {
      console.error("[cakto-webhook] ERRO ao buscar perfil:", selectErr.message);
      throw new Error(selectErr.message);
    }

    if (!perfil) {
      console.warn(`[cakto-webhook] AVISO: nenhum perfil encontrado para email="${email}". Usuário ainda não se cadastrou no app.`);
      return new Response(
        JSON.stringify({ ok: false, reason: "usuario_nao_cadastrado", email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cakto-webhook] perfil encontrado: id=${perfil.id} subscription_active=${perfil.subscription_active} plan_type=${perfil.plan_type}`);

    // ── 5. Montar update payload ──────────────────────────────────────────────
    let updatePayload: Record<string, unknown>;

    if (acao === "ativar") {
      const { plan_type, days } = detectPlan(body);
      const subscription_expires_at = days !== null
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : new Date(Date.now() + 10 * 365 * 86_400_000).toISOString(); // vitalício = 10 anos

      console.log(`[cakto-webhook] plano detectado: "${plan_type}" (${days ?? "vitalício"} dias) → expira ${subscription_expires_at}`);

      updatePayload = {
        subscription_active: true,
        plan_type,
        subscription_expires_at,
        // keep legacy columns in sync
        plano: plan_type,
        expires_at: subscription_expires_at,
      };
    } else {
      updatePayload = {
        subscription_active: false,
        subscription_expires_at: null,
        plan_type: null,
        plano: null,
        expires_at: null,
      };
    }

    console.log(`[cakto-webhook] aplicando update:`, JSON.stringify(updatePayload));

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", perfil.id);

    if (updateErr) {
      console.error("[cakto-webhook] ERRO ao atualizar perfil:", updateErr.message);
      throw new Error(updateErr.message);
    }

    console.log(`[cakto-webhook] SUCESSO: assinatura ${acao === "ativar" ? "ATIVADA" : "DESATIVADA"} para ${email}`);

    return new Response(
      JSON.stringify({ ok: true, acao, evento, email, profile_id: perfil.id, ...updatePayload }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[cakto-webhook] erro interno:", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
