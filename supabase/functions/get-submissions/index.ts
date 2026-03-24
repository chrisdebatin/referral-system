import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireAdminPin(req: Request): Response | null {
  const adminPin = Deno.env.get("ADMIN_PIN");
  if (!adminPin) {
    return json({ error: "ADMIN_PIN ist nicht gesetzt" }, 500);
  }
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== adminPin) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  const unauthorized = requireAdminPin(req);
  if (unauthorized) {
    return unauthorized;
  }

  const supabase = serviceClient();

  try {
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("referral_submissions")
        .select(
          "id, created_at, candidate_name, phone, email, qualification, nps_score, feedback, referral_code",
        )
        .order("created_at", { ascending: false });

      if (error) {
        return json({ error: error.message }, 500);
      }
      return json(data ?? []);
    }

    if (req.method === "POST" && action === "delete") {
      const body = await req.json().catch(() => null) as { id?: string } | null;
      const id = body?.id;
      if (!id || typeof id !== "string") {
        return json({ error: "id fehlt" }, 400);
      }

      const { error } = await supabase
        .from("referral_submissions")
        .delete()
        .eq("id", id);

      if (error) {
        return json({ error: error.message }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return json({ error: message }, 500);
  }
});
