// Supabase Edge Function: get-rsvps
// Returns all rows from ahmed_maha_rsvps when the correct passcode is sent.
// With { action: "delete", id } it deletes that one response instead.
// The passcode is NOT stored here: set it as a secret named ADMIN_PASSCODE
// (Supabase dashboard -> Edge Functions -> Secrets).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// constant-time string comparison
const safeEqual = (a: string, b: string) => {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ADMIN_PASSCODE");
  if (!expected) return json({ error: "ADMIN_PASSCODE secret is not set" }, 500);

  let body: { passcode?: unknown; action?: unknown; id?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // empty or invalid body
  }
  const passcode = String(body.passcode ?? "");

  if (!safeEqual(passcode, expected)) {
    // slow down guessing
    await new Promise((r) => setTimeout(r, 1500));
    return json({ error: "Wrong passcode" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (body.action === "delete") {
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid id" }, 400);
    const { error: delError } = await supabase.from("ahmed_maha_rsvps").delete().eq("id", id);
    if (delError) return json({ error: delError.message }, 500);
    return json({ deleted: id });
  }

  const { data, error } = await supabase
    .from("ahmed_maha_rsvps")
    .select("id, full_name, attendance, number_of_guests, message, created_at")
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json({ data });
});
