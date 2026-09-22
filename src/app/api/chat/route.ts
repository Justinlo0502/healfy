import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAthlete } from "@/lib/auth";
import { CHAT_TOOLS, executeTool } from "@/lib/chat-tools";

const MAX_TOOL_ITERATIONS = 6;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function systemPrompt(displayName: string | null): string {
  return `You are the AI training coach inside Healfy, a training-insight app built for one athlete${
    displayName ? ` (${displayName})` : ""
  }.

Ground every specific number, date, pace, HR value, training-load figure, or recovery score you state in a tool call — never invent or estimate one from general knowledge. If the tools don't return enough data to answer precisely, say so plainly instead of guessing.

When the data genuinely shows an overtraining or injury-risk signal (e.g. a high or "danger" acute:chronic workload ratio, persistent HR drift, poor recovery metrics), flag it directly and plainly — don't soften a real warning to be agreeable.

You are not a medical professional and this is not a diagnosis — it's training-load insight only. For pain, injury symptoms, or anything medical, tell the athlete to see a doctor or physio rather than advising on it yourself.

Keep responses conversational, concise, and grounded in the athlete's real data.`;
}

export async function POST(req: NextRequest) {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "`messages` must be a non-empty array" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI coach is not configured (missing ANTHROPIC_API_KEY)" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText: string | null = null;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt(athlete.displayName),
        tools: CHAT_TOOLS,
        messages,
      });
    } catch (err) {
      console.error("Anthropic request failed:", err);
      return NextResponse.json({ error: "The AI coach failed to respond. Please try again." }, { status: 502 });
    }

    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      break;
    }

    // Preserve the full assistant turn (including tool_use blocks) before
    // appending the tool results, as the API requires.
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      try {
        const result = await executeTool(block.name, block.input, athlete.id);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" }),
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (finalText === null) {
    finalText =
      "I wasn't able to finish gathering your training data to answer that — try asking again, maybe with a narrower question.";
  }

  if (!finalText) {
    finalText = "I didn't have a response for that — could you rephrase the question?";
  }

  return NextResponse.json({ role: "assistant", content: finalText });
}
