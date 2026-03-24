const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  candidate_name?: string;
  email?: string | null;
  qualification?: string | null;
  nps_score?: number | null;
  phone?: string | null;
  referral_code?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Nur Aufrufe mit gültigem anon key (wie dein Frontend) */
async function requireAnonCaller(req: Request): Promise<Response | null> {
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anon) {
    return json({ error: "SUPABASE_ANON_KEY fehlt in der Function-Umgebung" }, 500);
  }
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer !== anon && apikey !== anon) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const gate = await requireAnonCaller(req);
  if (gate) {
    return gate;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Ungültiger JSON-Body" }, 400);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo =
    Deno.env.get("REFERRAL_NOTIFY_EMAIL") ?? "christopher.debatin@igs-holding.de";
  const fromEmail = Deno.env.get("REFERRAL_FROM_EMAIL") ?? "Pflegeunion <onboarding@resend.dev>";

  if (!resendKey) {
    return json({
      ok: true,
      skipped: true,
      reason: "RESEND_API_KEY nicht gesetzt – keine E-Mail verschickt",
    });
  }

  const subject = `Neue Empfehlung: ${body.candidate_name ?? "(ohne Name)"}`;
  const text = [
    "Neue Mitarbeiter-Empfehlung",
    "",
    `Kandidat: ${body.candidate_name ?? ""}`,
    `Telefon: ${body.phone ?? ""}`,
    `E-Mail: ${body.email ?? ""}`,
    `Qualifikation: ${body.qualification ?? ""}`,
    `NPS: ${body.nps_score ?? ""}`,
    `Referral-Code: ${body.referral_code ?? ""}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notifyTo],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return json({ error: "Resend-Fehler", detail: errText }, 502);
  }

  // Optional: gleiche Zeile in DB loggen – hier nicht nötig, Insert kommt aus dem Client
  return json({ ok: true });
});
