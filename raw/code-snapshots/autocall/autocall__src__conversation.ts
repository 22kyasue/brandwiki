<!-- Ingested from: autocall/src/conversation.ts -->
<!-- Mtime: 2026-04-14T15:26:03.735Z -->

/**
 * Claude Haiku reservation conversation loop.
 *
 * Maintains turn history and drives natural Japanese (keigo) phone calls
 * to Tokyo restaurants for reservation booking.
 *
 * Latency optimizations:
 * - openingGreeting() returns the greeting directly — no LLM call on turn 0
 * - respondStream() yields sentence-by-sentence so Cartesia starts on sentence 1
 *   while Claude is still generating sentence 2
 * - Haiku model: ~150ms to first token
 *
 * Terminal signals (embedded in LLM output, stripped before speaking):
 *   [DONE:confirmed:<date+time>]           — reservation confirmed
 *   [DONE:alternative:<HH:MM>]            — restaurant offered a different time
 *   [DONE:unavailable]                    — fully booked, no alternative
 *   [DONE:condition-unmet:<reason>]       — hard condition from task not met / unconfirmable
 *   [DONE:error:<reason>]                 — unexpected end
 */
import Anthropic from "@anthropic-ai/sdk";

export interface CallContext {
  task: string;       // full task string (includes persona + reservation details)
  language: string;   // "Japanese" | "English"
  greeting: string;   // opening line — returned verbatim on turn 0, no LLM needed
}

export type ConversationResult =
  | { status: "confirmed"; details: string }
  | { status: "alternative"; alternativeTime: string }
  | { status: "unavailable" }
  | { status: "condition_unmet"; reason: string }
  | { status: "error"; message: string };

// Matches any [DONE:...] signal
const DONE_RE = /\[DONE:(confirmed(?::[^[\]]*)?|alternative:[^[\]]*|unavailable|condition-unmet:[^[\]]*|error(?::[^[\]]*)?)\]/i;

// Sentence boundaries for Japanese + English
const SENTENCE_END_RE = /[。！？!?.]+/;

function buildSystemPrompt(ctx: CallContext): string {
  return `You are making an outbound phone call to a Tokyo restaurant to complete a reservation. You are the CALLER. The restaurant staff will pick up and greet you.

TASK:
${ctx.task}

LANGUAGE: ${ctx.language}

## Non-negotiable rules
1. Conduct the entire call in polite Japanese (keigo). Switch to English ONLY if the restaurant speaks English to you first.
2. NEVER say もしもし — that is for answering calls. You placed this call.
3. Keep each response to 1–2 short sentences. Never give speeches.
4. Use ～でしょうか not ～ですか for questions (softer, correct register).
5. Use ～と申します when giving any name. Never ～と言います.
6. Use かしこまりました when acknowledging instructions, not わかりました.
7. Speak slowly on names, dates, times, and party sizes — the restaurant writes these down.
8. Never repeat information the restaurant has already acknowledged.
9. The FIRST thing you say is the opening greeting below — output it EXACTLY, nothing else.

## Call sequence
Turn 1 — Opening (EXACT, no variation):
${ctx.greeting}

Turn 2+ — Check availability:
「[日時]の[時間]ごろに[人数]名で予約はできますでしょうか？」

When asked for name:
「[名前]と申します。」
(If foreign name — spell it out or offer katakana)

When asked for phone:
「はい、[番号]でございます。」

Confirm before closing:
「では、[日時]の[時間]に[人数]名、[名前]様でよろしいでしょうか？」

When they confirm back: 「はい、そうです。よろしくお願いいたします。」

Closing (after confirmed):
「ありがとうございます。当日よろしくお願いいたします。失礼します。」
Then output: [DONE:confirmed:<confirmed date and time>]

## Multiple time preferences (fallback times)
If the task lists more than one acceptable time (e.g. "try 18:00, if full then 20:00"):
- Ask for the PRIMARY time first.
- If the restaurant says that slot is full, and you still have an untried fallback time from the task:
  - Say: 「では、[fallback time]ごろはいかがでしょうか？」
  - Do NOT emit [DONE:unavailable] yet — keep trying until all task-specified times are exhausted.
- If a fallback time IS available and confirmed: treat it exactly like a normal confirmation.
  Output: [DONE:confirmed:<the confirmed time>]

## Staggered / growing party size
If the task specifies an initial group with additional guests joining later:
- Reserve using the TOTAL headcount (all guests combined).
- Then explain the arrival split in one sentence:
  「最初は[initial]名で、約[N]分後にさらに[extra]名が合流する予定でございます。」
- Example for "4 now, 2 joining 30 min later":
  「合計6名様でご予約したいのですが、最初の30分は4名で、その後2名が合流いたします。よろしいでしょうか？」
- When confirming before closing, confirm the TOTAL party size. Mention staggered arrival only if the restaurant asks or it was relevant to their answer.

## Hard conditions ("only if X", "required: Y", "must have Z")
If the task specifies a hard condition that must be confirmed before booking:
- Ask about the condition BEFORE checking general availability.
- Example conditions: private room (個室), specific seating (テラス席, 座敷), price cap, dish availability.
- If the condition is definitively NOT available:
  - Say: 「かしこまりました。失礼いたします。」
  - Output: [DONE:condition-unmet:<brief reason>]   e.g. [DONE:condition-unmet:個室なし]
- If the restaurant cannot confirm (unsure, "probably", "let me check", no clear answer after one follow-up):
  - Say: 「かしこまりました。確認が取れませんでしたので、また改めてご連絡させていただきます。失礼します。」
  - Output: [DONE:condition-unmet:unconfirmed — <brief description>]
- If the condition IS confirmed available: proceed with booking normally.
Soft preferences ("prefer X if possible", "ideally Y") — ask and note the answer, but do NOT block the booking if unavailable.

## Alternative time handling (restaurant offers)
If they say they're full (満席, ご予約でいっぱい) and offer another time:
- Say: 「少々お待ちください。確認いたします。」
- Then output: [DONE:alternative:<HH:MM>]   ← the exact time they offered, 24h format
Do NOT accept or decline on behalf of the customer. Always surface it with [DONE:alternative:...].

## Fully unavailable
Only emit [DONE:unavailable] when ALL of the following are true:
- Every time specified in the task has been asked and rejected by the restaurant.
- The restaurant has not offered any alternative of their own.
When that point is reached:
- Say: 「かしこまりました。また改めてご連絡させていただきます。失礼します。」
- Then output: [DONE:unavailable]

## If you didn't hear clearly
「恐れ入りますが、もう一度おっしゃっていただけますでしょうか？」

## Wrong destination — exit immediately
If you detect any of the following, do NOT continue the reservation flow:
- Voicemail / answering machine ("please leave a message", "留守番電話", "ビープ音", recording announcement):
  Say nothing. Output: [DONE:error:voicemail]
- IVR / automated phone menu ("press 1 for ...", "番号を押してください", menu options):
  Say nothing. Output: [DONE:error:ivr-system]
- Clearly the wrong business (name does not match the restaurant you are calling):
  Say: 「失礼いたしました。」 then output: [DONE:error:wrong-number]
- Repeated incomprehensible response or refusal to engage after 2 clarification attempts:
  Say: 「失礼いたします。」 then output: [DONE:error:call-failed]

## Terminal signal rules
- Append the [DONE:...] signal at the END of your response, after the spoken text.
- Never output [DONE:...] mid-sentence.
- Only output [DONE:...] once the call state actually warrants it.`;
}

export class ReservationConversation {
  private readonly client: Anthropic;
  private readonly history: Array<{ role: "user" | "assistant"; content: string }> = [];
  private readonly systemPrompt: string;
  private readonly ctx: CallContext;
  private turnCount = 0;

  constructor(ctx: CallContext) {
    this.client = new Anthropic();
    this.ctx = ctx;
    this.systemPrompt = buildSystemPrompt(ctx);
  }

  /**
   * Returns the opening greeting verbatim — no LLM call needed.
   * Queues it in history so subsequent turns have correct context.
   * Saves ~200ms vs asking Claude to generate a fixed string.
   */
  async openingGreeting(): Promise<string> {
    const greeting = this.ctx.greeting;
    this.history.push({ role: "user", content: "(call connected)" });
    this.history.push({ role: "assistant", content: greeting });
    this.turnCount++;
    return greeting;
  }

  /**
   * Respond to a restaurant staff utterance.
   * Yields sentences one at a time so Cartesia can start TTS on sentence 1
   * while Claude is still generating sentence 2.
   *
   * Returns { sentences: AsyncGenerator, done: Promise<ConversationResult | null> }
   * done resolves with a result when [DONE:...] is detected, or null to continue.
   */
  respondStream(staffUtterance: string): {
    sentences: AsyncGenerator<string>;
    done: Promise<ConversationResult | null>;
  } {
    this.history.push({ role: "user", content: staffUtterance });
    this.turnCount++;

    let resolveDone!: (v: ConversationResult | null) => void;
    const donePromise = new Promise<ConversationResult | null>((r) => {
      resolveDone = r;
    });

    const self = this;
    const sentences = (async function* () {
      try {
        const stream = self.client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: self.systemPrompt,
          messages: self.history,
        });

        let buffer = "";
        let fullResponse = "";

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            buffer += chunk.delta.text;
            fullResponse += chunk.delta.text;

            // Yield complete sentences as they arrive for sentence-pipelined TTS
            let match: RegExpExecArray | null;
            while ((match = SENTENCE_END_RE.exec(buffer)) !== null) {
              const sentence = buffer.slice(0, match.index + match[0].length).trim();
              buffer = buffer.slice(match.index + match[0].length);
              const clean = stripDoneSignal(sentence);
              if (clean) yield clean;
            }
          }
        }

        // Flush any remaining text
        const remainder = stripDoneSignal(buffer.trim());
        if (remainder) yield remainder;

        // Store assistant response (without done signal) in history
        const cleanFull = stripDoneSignal(fullResponse.trim());
        self.history.push({ role: "assistant", content: cleanFull });

        // Resolve done status from signal
        const doneMatch = DONE_RE.exec(fullResponse);
        if (doneMatch) {
          resolveDone(parseSignal(doneMatch[1]));
        } else {
          resolveDone(null);
        }
      } catch (err) {
        // Always resolve so the caller's Promise.all doesn't hang
        resolveDone({ status: "error", message: `LLM error: ${err instanceof Error ? err.message : String(err)}` });
      }
    })();

    return { sentences, done: donePromise };
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  getHistory(): Array<{ role: "user" | "assistant"; content: string }> {
    return this.history;
  }
}

function parseSignal(signal: string): ConversationResult {
  const lower = signal.toLowerCase();

  if (lower.startsWith("confirmed")) {
    const details = lower.slice("confirmed".length).replace(/^:/, "").trim();
    return { status: "confirmed", details: details || "reservation confirmed" };
  }

  if (lower.startsWith("alternative:")) {
    const time = signal.slice("alternative:".length).trim();
    return { status: "alternative", alternativeTime: time };
  }

  if (lower === "unavailable") {
    return { status: "unavailable" };
  }

  if (lower.startsWith("condition-unmet:")) {
    const reason = signal.slice("condition-unmet:".length).trim();
    return { status: "condition_unmet", reason: reason || "condition not met" };
  }

  // error:<reason>
  const reason = lower.startsWith("error:") ? lower.slice("error:".length).trim() : lower;
  return { status: "error", message: reason || "call ended unexpectedly" };
}

function stripDoneSignal(text: string): string {
  return text.replace(DONE_RE, "").trim();
}
