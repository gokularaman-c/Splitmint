// MintSense AI: parse natural language expense + summarize group
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    const AI_API_URL = Deno.env.get("AI_API_URL");
    const AI_MODEL = Deno.env.get("AI_MODEL");

    if (!AI_API_KEY) throw new Error("AI_API_KEY not configured");
    if (!AI_API_URL) throw new Error("AI_API_URL not configured");
    if (!AI_MODEL) throw new Error("AI_MODEL not configured");

    const body = await req.json();
    const { mode } = body;

    if (mode === "parse") {
      const { text, participants } = body as {
        text: string;
        participants: { id: string; name: string; is_owner?: boolean }[];
      };

      const sys = `Extract a structured expense from the user's text. Available participants (id, name): ${JSON.stringify(participants)}. The "owner" participant represents the user themselves, so use them when text says "I" or "me". Today's date is ${new Date().toISOString().slice(0, 10)}.`;

      const tools = [
        {
          type: "function",
          function: {
            name: "create_expense",
            description: "Create a single expense record",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string" },
                amount: { type: "number" },
                category: {
                  type: "string",
                  enum: ["general", "food", "travel", "rent", "utilities", "shopping", "entertainment"],
                },
                date: { type: "string", description: "YYYY-MM-DD" },
                payer_id: { type: "string", description: "id of payer participant" },
                participant_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "ids of participants involved in the split",
                },
              },
              required: ["description", "amount", "category", "payer_id", "participant_ids"],
              additionalProperties: false,
            },
          },
        },
      ];

      const r = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: text },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "create_expense" } },
        }),
      });

      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);

      const j = await r.json();
      const call = j.choices?.[0]?.message?.tool_calls?.[0];

      if (!call) throw new Error("No structured response");

      const args = JSON.parse(call.function.arguments);

      return new Response(JSON.stringify({ expense: args }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "summary") {
      const { participants, expenses, balances, settlements } = body;

      const sys =
        "You are MintSense, a friendly expense assistant. Write a concise, warm summary in 4-6 sentences of this group's spending. Mention total spent, top spender, and recommended settlements. Use plain text, no markdown headers.";

      const userMsg = `Participants: ${JSON.stringify(participants)}
Expenses: ${JSON.stringify(expenses)}
Balances: ${JSON.stringify(balances)}
Suggested settlements: ${JSON.stringify(settlements)}`;

      const r = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
        }),
      });

      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);

      const j = await r.json();

      return new Response(JSON.stringify({ summary: j.choices?.[0]?.message?.content ?? "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("mintsense error", e);

    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
