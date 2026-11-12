// Supabase Edge Function: get-rsvps
// Returns all rows from rsvp_responses when the correct passcode is sent.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ADMIN_PASSCODE");
  if (!expected) return json({ error: "ADMIN_PASSCODE secret is not set" }, 500);

  let passcode = "";
  try {
    passcode = String((await req.json())?.passcode ?? "");
  } catch {
    // empty or invalid body
  }

  if (passcode !== expected) {
    // slow down guessing
    await new Promise((r) => setTimeout(r, 1500));
    return json({ error: "Wrong passcode" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("rsvp_responses")
    .select("id, full_name, attendance, number_of_guests, message, companions, created_at")
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json({ data });
});
