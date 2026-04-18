<!-- Ingested from: backend/src/lib/claude.ts -->
<!-- Mtime: 2026-04-14T14:47:07.508Z -->

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { executeToolCall } from "./tools";
import { transition, BookingContext } from "./booking-state";
import { getSession, setSession } from "./sessions";
import { getUserPreferences, formatPreferencesForPrompt } from "./preferences";

const SYSTEM_PROMPT = `You are Yoyakun (ヨヤクン) — a food-obsessed, bubbly Tokyo restaurant guide. You talk like a close friend who knows every great spot in the city. Enthusiastic, warm, a little playful.

**Language: {LANGUAGE_INSTRUCTION}**

Voice:
- Casual and conversational. Short sentences. Natural rhythm.
- Drop in "美味しそう！", "すごい！", "よし！" when genuinely excited — not every message.
- Call yourself "ヨヤクン" occasionally, but don't overdo it.
- Never sound like a customer service bot. No "かしこまりました" or "承知いたしました" — keep it friendly and direct.
- Never start a response with "Reading this as:", "読んだ：", or any restatement of the user's message. Just respond directly.
- If something goes wrong, be real about it and pivot fast.

## FIRST: read the intent

Before anything else, classify what the user sent into one of three modes:

### BOOKING INTENT mode — they want to make a reservation but haven't given details

Triggers: "make a reservation", "book a restaurant", "reserve a table", "can you book", "I want to eat out", "let's do dinner", "wanna grab food", "do you want to do a reservation", or any message that's clearly about booking but lacks specifics.

If the message includes cuisine or location → search immediately and show results. Ask for any missing info (when, how many) in the same response.
If the message has NO cuisine or location → ask all missing pieces together in ONE message: food type, when, how many people.

Do NOT delay searching when you already have enough to find options.

### RIGHT NOW mode — they're hungry now and want to eat immediately

Signals: "now", "tonight", "hungry", "right now", "ASAP", "open now", or immediate hunger with no future date.

If cuisine/location are in the message → search immediately (use party_size=2 if not specified). Show results first, then ask for any missing details (party size, time) in the same response.
Never block searching just because party size is missing — default to 2 and note it.

Once you have enough: call search_restaurants with open_now=true, then check_availability on top 2 results in parallel.

### FUTURE PLANNING mode — specific future date or explicit planning

Signals: a specific date, "this weekend", "next Friday", "for my birthday", "planning", "thinking about".

If location/cuisine are in the message → search broadly immediately (no open_now filter, use party_size=2 if not specified). Show results and ask for any missing info in the same response.
Never block searching just because party size or date is missing — search now, ask after.

Present 3–4 options with vibe + why it fits their occasion. Let them narrow down before checking availability. Always call search_restaurants with limit=5 unless the user explicitly asks for more.

---

**VIBE SIGNALS — pick up on anything they drop:**
- Price: "cheap", "on a budget", "something nice", "splurge", "fancy", "casual"
- Occasion: "date night", "with the kids", "business dinner", "birthday", "quick lunch", "solo"
- Cuisine mood: "something light", "heavy", "comfort food", "something adventurous"
- These shape how you describe results and what you prioritize.

**Budget → price_level mapping — ALWAYS pass price_level when any budget signal is present:**
- "cheap", "budget", "affordable", "casual", "quick" → price_level: 2
- "mid-range", "moderate", "reasonable", "not too expensive", "something nice", "date night" → price_level: 3
- "splurge", "luxury", "omakase", "fine dining", "special occasion" → omit price_level (no filter)
This is a MAX filter — price_level: 3 means "at most ¥15,000/person", not "exactly ¥10,000".

## Tool rules (always apply)

- When the user's message has clear restaurant or booking intent, call the relevant tool immediately — do not ask follow-up questions before searching.
- **Always pass cuisine to search_restaurants** when the user mentions a food type ("Italian", "sushi", "ramen", etc.). Never use cuisine only as description flavor — it must be the cuisine parameter in the tool call.
- For greetings, chitchat, or messages with no restaurant intent, respond naturally without calling tools.
- search_restaurants now returns phone, openingHours, and topReviews inline for the #1 result. Do NOT call get_restaurant_details after a search — use the inline data already in the result. Only call get_restaurant_details if the user asks specifically about a different restaurant from the list that has no inline details.
- Call save_user_preferences only when the user explicitly states a new preference.
- Do not repeat a tool call if the result is already in context.

## How to talk about restaurants

- Lead with the vibe. Describe them like you've eaten there.
- Mention the name, what it's known for, why someone would love it.
- Weave options into natural text — not bullet lists unless there are 4+ items.
- When get_restaurant_details returns topReviews, pull one or two vivid phrases from them naturally into your description. Don't quote verbatim — paraphrase the feeling. E.g. "Reviewers keep coming back for the wagyu — apparently the staff remember regulars by name." Skip reviews if they add nothing new.

## Booking flow

- You need: restaurant, date, time, party size, name. Collect missing info one question at a time.
- Once you have everything, confirm in one short message then proceed immediately.
- Always respond in the app's configured language.

## Online vs phone booking

- source="tabelog" + non-empty slots → use make_reservation.
- source="phone_only" OR empty slots → use make_phone_reservation. Never pretend slots exist.
- After make_phone_reservation, say the call is in progress and offer check_call_status.

## CRITICAL — Phone call confirmation gate

NEVER call make_phone_reservation with user_confirmed=true until the user has explicitly confirmed in the current message (e.g. "yes", "go ahead", "call them", "confirm").

The correct flow:
1. Collect all reservation details.
2. Show a summary: "Ready to call [restaurant] at [phone] — [date] at [time] for [N] people. Shall I go ahead?"
3. Wait for explicit user confirmation.
4. Only then call make_phone_reservation with user_confirmed=true.

If you call with user_confirmed=false or omit it, the tool will return a warning and NOT place the call. Never try to work around this gate.

## Phone call outcomes — read the transcript

When check_call_status returns status="completed", you MUST read the transcript before responding. Determine which case applies:

**Case 1 — Confirmed at requested time:**
Great, tell the user it's booked. Give them the details: restaurant, date, time, party size.

**Case 2 — Restaurant offered an alternative time:**
The restaurant said no to the original time but has something else available. Extract the alternative time from the transcript and ask the user directly:
"They're fully booked at [original time] but [alternative time] is open — want me to lock that in?"
If yes → call make_phone_reservation again with the new time.
If no → offer to try a different restaurant.

**Case 3 — Fully rejected / no availability:**
Tell the user clearly: "No luck — [restaurant] is fully booked." Then immediately offer: "Want me to check somewhere else nearby?"

**Case 4 — Call failed or no answer:**
Be real about it. "The call didn't go through." Offer to try again or try online booking if available.

Never tell the user a booking is confirmed unless the transcript actually shows the restaurant confirmed it.

## Location

- If [USER LOCATION] is in context, use those coordinates when the user says "near me" or "nearby".
- Don't ask for a neighborhood name if you already have coordinates.

## Train Line Search

When the user says something like "along the Mita line", "near Hibiya line stations", "somewhere on the Yamanote line", use the train_line parameter in search_restaurants. Supported values: yamanote (山手線), mita (三田線), ginza (銀座線), hibiya (日比谷線), chuo (中央線), oedo (大江戸線), toyoko (東横線). You can combine with cuisine. Skip the location param when train_line is set.

Keep it short. Keep it real. Make people hungry.`;

type ToolCallEntry = { name: string; input: Record<string, unknown>; result: unknown };

function applyToolResult(
  ctx: BookingContext,
  name: string,
  input: Record<string, unknown>,
  result: unknown
): BookingContext {
  const r = result as Record<string, unknown>;
  switch (name) {
    case "get_restaurant_details": {
      const rName = r?.name as string | undefined;
      if (rName) return transition(ctx, "PROVIDE_DETAILS", { restaurantName: rName });
      return ctx;
    }
    case "check_availability": {
      const data: Record<string, unknown> = {
        restaurantName: input.restaurant_name,
        date: input.date,
        partySize: input.party_size,
        ...(input.requested_time ? { time: input.requested_time } : {}),
      };
      let next = transition(ctx, "CHECK_AVAILABLE", data);
      const slots = r?.availableSlots;
      if (Array.isArray(slots) && slots.length > 0) next = transition(next, "CONFIRM");
      return next;
    }
    case "make_reservation": {
      if (r?.success === false) return transition(ctx, "FAIL");
      const cData: Record<string, unknown> = {
        restaurantName: (r?.confirmation as Record<string, unknown> | undefined)?.restaurant,
        confirmationCode: r?.bookingId,
      };
      let next = ctx;
      if (next.state !== "confirming") next = transition(next, "CONFIRM");
      if (next.state !== "booking") next = transition(next, "BOOK", cData);
      next = transition(next, "SUCCESS", cData);
      return next;
    }
    case "make_phone_reservation": {
      if (r?.success === false && r?.status !== "timeout") return transition(ctx, "FAIL");
      const phoneData: Record<string, unknown> = {
        restaurantName: input.restaurant_name,
        ...(r?.callId ? { callId: r.callId as string } : {}),
        ...(r?.bookingId ? { confirmationCode: r.bookingId as string } : {}),
      };
      // If the call completed inline (inline polling resolved), skip to the correct end state
      if (r?.status === "confirmed") {
        let next = ctx;
        if (next.state !== "calling") next = transition(next, "PHONE_CALL", phoneData);
        return transition(next, "SUCCESS", phoneData);
      }
      if (r?.status === "failed" || r?.status === "error") {
        return transition(ctx, "FAIL");
      }
      // Default: call is in progress — stay in PHONE_CALL state
      return transition(ctx, "PHONE_CALL", phoneData);
    }
    case "check_call_status": {
      const status = r?.status as string | undefined;
      if (status === "failed" || status === "error") {
        return transition(ctx, "FAIL");
      }
      if (status === "completed") {
        const transcript = (r?.transcript as string | undefined) ?? "";
        // Only transition to SUCCESS if the transcript indicates a confirmed booking.
        // "alternative_offered" stays in PHONE_CALL so Claude can present the outcome.
        const confirmed = /confirm|reserv|booked|all set|no problem|great|certainly|sure/i.test(transcript);
        if (confirmed) {
          return transition(ctx, "SUCCESS", {
            confirmationCode: transcript.slice(0, 60) || "Called",
          });
        }
      }
      return ctx;
    }
    default:
      return ctx;
  }
}

function createYoyakuServer(log: ToolCallEntry[], ctxRef: { current: BookingContext }, sessionId: string, userId?: string) {
  function wrap<T extends Record<string, z.ZodTypeAny>>(
    name: string,
    description: string,
    schema: T,
  ) {
    return tool(name, description, schema, async (input) => {
      const result = await executeToolCall(name, input as Record<string, unknown>, userId);
      log.push({ name, input: input as Record<string, unknown>, result });
      ctxRef.current = applyToolResult(ctxRef.current, name, input as Record<string, unknown>, result);
      let text: string;
      try {
        text = JSON.stringify(result);
      } catch {
        text = JSON.stringify({ error: "Result could not be serialized" });
      }
      return { content: [{ type: "text" as const, text }] };
    });
  }

  return createSdkMcpServer({
    name: "yoyaku",
    tools: [
      wrap("search_restaurants", "Search for restaurants based on location, cuisine type, price range", {
        location: z.string().describe("The location to search in (e.g. 'Shibuya, Tokyo'). Use 'near me' if the user asked for nearby places and coordinates are in context."),
        cuisine: z.string().optional().describe("Type of cuisine (e.g. 'Sushi', 'Italian')"),
        price_level: z.number().optional().describe("Price level 1 (cheap) to 4 (expensive)"),
        open_now: z.boolean().optional().describe("Only show currently open restaurants"),
        latitude: z.number().optional().describe("User's latitude — include when the user asks for places 'near me' or 'nearby'"),
        longitude: z.number().optional().describe("User's longitude — include when the user asks for places 'near me' or 'nearby'"),
        train_line: z.string().optional().describe("Tokyo train/subway line to search along. Values: yamanote, mita, ginza, hibiya, chuo, oedo, toyoko. Use when user says 'along the X line' or 'near X line stations'. Skip location when this is set."),
        limit: z.number().optional().describe("Max results to return. Default 5. Increase to 10 only if user explicitly asks for more options."),
      }),
      wrap("get_restaurant_details", "Get detailed information about a specific restaurant", {
        restaurant_id: z.string().describe("The unique ID of the restaurant from search results"),
      }),
      wrap("check_availability", "Check available time slots for a restaurant on a specific date, optionally around a preferred time", {
        restaurant_id: z.string(),
        restaurant_name: z.string(),
        date: z.string().describe("Date in YYYY-MM-DD format"),
        party_size: z.number().describe("Number of people in the party"),
        requested_time: z.string().optional().describe("Preferred time in HH:MM format so nearby +/- 30 minute alternatives can be suggested if needed"),
        location: z.string().optional().describe("Original search area, used only when suggesting nearby alternatives"),
        cuisine: z.string().optional().describe("Cuisine hint used only when suggesting nearby alternatives"),
      }),
      wrap("make_reservation", "Create a reservation at a restaurant", {
        restaurant_id: z.string(),
        restaurant_name: z.string(),
        date_time: z.string().describe("Date and time in ISO 8601 format"),
        party_size: z.number(),
        customer_name: z.string(),
        customer_phone: z.string().optional(),
        customer_email: z.string().optional(),
        special_requests: z.string().optional(),
      }),
      wrap("get_user_bookings", "Get all bookings for a user, optionally filtered by status", {
        customer_name: z.string().optional().describe("Name to search bookings for"),
        status: z.enum(["confirmed", "cancelled", "completed", "all"]).optional(),
      }),
      wrap("cancel_booking", "Cancel an existing reservation", {
        booking_id: z.string().describe("The unique ID of the booking to cancel"),
      }),
      wrap("make_phone_reservation", "Call a restaurant by phone to make a reservation when online booking is unavailable. MUST show the user a summary and wait for explicit confirmation before setting user_confirmed=true.", {
        restaurant_name: z.string().describe("Name of the restaurant to call"),
        restaurant_phone: z.string().optional().describe("Phone number of the restaurant if known"),
        date: z.string().describe("Date of reservation in YYYY-MM-DD format"),
        time: z.string().describe("Time of reservation in HH:MM format"),
        party_size: z.number().describe("Number of people"),
        customer_name: z.string().describe("Name for the reservation"),
        customer_phone: z.string().optional().describe("Customer callback phone number"),
        special_requests: z.string().optional().describe("Any special requests or notes"),
        user_confirmed: z.boolean().optional().describe("Set to true ONLY after the user has explicitly confirmed they want to place this call. Omit or set false to do a dry-run check without placing the call."),
      }),
      wrap("check_call_status", "Check the status of a phone call reservation. When status is 'completed', read the full transcript to determine the actual outcome: (1) confirmed at the requested time, (2) restaurant offered an alternative time — extract that time and present it to the user, (3) fully rejected — no availability. Do NOT mark as success until you have read the transcript and understood what the restaurant agreed to.", {
        call_id: z.string().describe("The call ID returned by make_phone_reservation"),
      }),
      wrap("modify_reservation", "Modify an existing reservation: update the date/time or party size", {
        booking_id: z.string().describe("The booking ID to modify"),
        date_time: z.string().optional().describe("New date and time in ISO 8601 format"),
        party_size: z.number().optional().describe("New party size"),
      }),
      wrap("save_user_preferences", "Save the user's dining preferences whenever they reveal dietary restrictions, favorite cuisines, preferred areas, usual party size, budget, or phone number. Call this silently in the background — do not announce it to the user.", {
        cuisines: z.array(z.string()).optional().describe("Favorite cuisine types e.g. ['Sushi', 'Ramen']"),
        restrictions: z.array(z.string()).optional().describe("Dietary restrictions and allergies e.g. ['vegetarian', 'shellfish allergy', 'halal']"),
        areas: z.array(z.string()).optional().describe("Preferred neighborhoods or areas e.g. ['Shibuya', 'Shinjuku']"),
        phone: z.string().optional().describe("User's phone number for reservations e.g. '090-1234-5678'"),
        partySize: z.number().optional().describe("Usual party size"),
        budget: z.string().optional().describe("Budget preference e.g. '¥3000–¥5000 per person'"),
        freeText: z.string().optional().describe("Any other preference notes that don't fit the above fields"),
      }),
    ],
  });
}

type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "tool_status"; toolName: string }
  | { type: "tool_result"; toolName: string; toolInput: Record<string, unknown>; result: unknown }
  | { type: "done"; toolCalls: ToolCallEntry[]; sessionId: string; bookingState: BookingContext };

export async function* streamAgent(
  userMessage: string,
  sessionId?: string,
  userId?: string,
  userContext?: string,
  selectedRestaurant?: Record<string, unknown>,
  lang?: string,
  prefsSection?: string
): AsyncGenerator<StreamChunk> {
  const sid = sessionId ?? "";
  const ctxRef = { current: sid ? getSession(sid) : { state: "idle" as const } };
  const toolCallsLog: ToolCallEntry[] = [];
  const server = createYoyakuServer(toolCallsLog, ctxRef, sid, userId);
  let newSessionId = sessionId ?? "";
  let emittedCount = 0;

  const resolvedPrefsSection = prefsSection !== undefined
    ? prefsSection
    : userId
      ? formatPreferencesForPrompt(await getUserPreferences(userId))
      : "";

  let selectedRestaurantContext = "";
  if (selectedRestaurant) {
    const r = selectedRestaurant;
    const name = r.name as string || "";
    const nameJa = r.nameJa as string | undefined;
    const cuisine = Array.isArray(r.cuisine) ? (r.cuisine as string[]).join(", ") : (r.cuisine as string || "");
    const tabelogRating = r.tabelogRating as number | undefined;
    const googleRating = r.googleRating as number | undefined;
    const ratingCount = r.ratingCount as number | undefined;
    const priceRange = r.priceRange as string | undefined;
    const priceLevel = r.priceLevel as string | undefined;
    const address = r.address as string | undefined;
    const hasOnlineBooking = r.hasOnlineBooking as boolean | undefined;
    const tabelogUrl = r.tabelogUrl as string | undefined;
    const ratingStr = [
      tabelogRating && `Tabelog ★${tabelogRating}`,
      googleRating && `Google ★${googleRating}`,
      ratingCount && `${ratingCount} reviews`,
    ].filter(Boolean).join(" · ");
    selectedRestaurantContext = [
      `[PANEL OPEN] User has this restaurant open in their panel — treat "this place", "here", "it" as referring to it:`,
      `Name: ${name}${nameJa ? ` (${nameJa})` : ""}`,
      cuisine && `Cuisine: ${cuisine}`,
      ratingStr && `Rating: ${ratingStr}`,
      (priceRange || priceLevel) && `Price: ${priceRange || priceLevel}`,
      address && `Address: ${address}`,
      `Online booking: ${hasOnlineBooking ? "Yes" : "No"}`,
      tabelogUrl && `Tabelog: ${tabelogUrl}`,
    ].filter(Boolean).join("\n");
  }

  const languageInstruction = lang === "en"
    ? "Always respond in English. This is an English-mode session. Even if the user writes in Japanese, reply in English."
    : "Always respond in Japanese. This is a Japan-first app. Use casual, friendly Japanese — the kind you'd text a foodie friend. If the user writes in English, still respond in Japanese (they'll understand — it's Tokyo).";

  const systemPrompt = [
    SYSTEM_PROMPT.replace("{LANGUAGE_INSTRUCTION}", languageInstruction),
    resolvedPrefsSection,
    userContext ? `[PERSONALIZATION CONTEXT]\n${userContext}` : "",
    selectedRestaurantContext,
  ].filter(Boolean).join("\n\n");

  for await (const message of query({
    prompt: userMessage,
    options: {
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      mcpServers: { yoyaku: server },
      allowedTools: [
        "mcp__yoyaku__search_restaurants",
        "mcp__yoyaku__get_restaurant_details",
        "mcp__yoyaku__check_availability",
        "mcp__yoyaku__make_reservation",
        "mcp__yoyaku__get_user_bookings",
        "mcp__yoyaku__cancel_booking",
        "mcp__yoyaku__make_phone_reservation",
        "mcp__yoyaku__check_call_status",
        "mcp__yoyaku__modify_reservation",
        "mcp__yoyaku__save_user_preferences",
      ],
      ...(sessionId ? { resume: sessionId } : {}),
    },
  })) {
    // Eagerly emit any tool results that completed since the last iteration
    while (emittedCount < toolCallsLog.length) {
      const entry = toolCallsLog[emittedCount];
      yield { type: "tool_result", toolName: entry.name, toolInput: entry.input, result: entry.result };
      emittedCount++;
    }

    if (message.type === "system" && message.subtype === "init") {
      newSessionId = (message as { session_id: string }).session_id;
    } else if (message.type === "assistant") {
      const assistantMsg = message as { message: { content: Array<{ type: string; text?: string; name?: string }> } };
      for (const block of assistantMsg.message?.content ?? []) {
        if (block.type === "text" && block.text) {
          yield { type: "delta", text: block.text };
        } else if (block.type === "tool_use" && block.name) {
          yield { type: "tool_status", toolName: block.name };
        }
      }
    } else if (message.type === "result") {
      yield { type: "done", toolCalls: toolCallsLog, sessionId: newSessionId, bookingState: ctxRef.current };
    }
  }

  if (newSessionId) setSession(newSessionId, ctxRef.current);
}
