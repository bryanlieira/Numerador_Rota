import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_EMAIL = "bryanoliveira.br@gmail.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Service-role client (bypasses RLS, used for everything) ──────────────
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Validate caller JWT ───────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    console.error("[admin-profiles] sem token na requisição");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service client to validate the user token — more reliable than anon client inside edge functions
  const { data: { user }, error: userErr } = await serviceClient.auth.getUser(token);

  if (userErr) {
    console.error("[admin-profiles] getUser error:", userErr.message);
    return new Response(JSON.stringify({ error: "unauthorized", detail: userErr.message }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!user) {
    console.error("[admin-profiles] token inválido ou expirado");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (user.email !== ADMIN_EMAIL) {
    console.warn(`[admin-profiles] acesso negado para ${user.email}`);
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[admin-profiles] acesso autorizado para ${user.email}`);

  // GET → list all profiles
  if (req.method === "GET") {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id, email, subscription_active, expires_at, plano, plan_type, subscription_expires_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin-profiles] erro ao listar profiles:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-profiles] retornando ${data?.length ?? 0} perfis`);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST → update subscription for a user
  if (req.method === "POST") {
    const body = await req.json();
    const { id, subscription_active, subscription_expires_at, plan_type, expires_at, plano } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-profiles] atualizando perfil id=${id} subscription_active=${subscription_active} plan_type=${plan_type}`);

    const { error } = await serviceClient
      .from("profiles")
      .update({
        subscription_active: subscription_active ?? false,
        subscription_expires_at: subscription_expires_at ?? null,
        plan_type: plan_type ?? null,
        expires_at: expires_at ?? subscription_expires_at ?? null,
        plano: plano ?? plan_type ?? null,
      })
      .eq("id", id);

    if (error) {
      console.error("[admin-profiles] erro ao atualizar perfil:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-profiles] perfil ${id} atualizado com sucesso`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
