---
title: Chat Interface Frontend (ChatInterface.tsx)
category: 03-architecture
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/code-snapshots/frontend/frontend__src__components__ChatInterface.tsx, raw/decisions/docs__direction-listings-ux.md]
---

## Role

`frontend/src/components/ChatInterface.tsx` is the entire chat UI hot path. It composes all major UI surfaces: message list, Yoyakun character, booking progress bar, confirmation widget, history sidebar, and the input form.

**Modification rule:** Name the exact function before touching this file. Never refactor as a side-effect of a feature change.

## Key Hooks

- `useStreamingChat(token, onTokenRefresh)` — provides `messages`, `isLoading`, `bookingState`, `sendMessage`, `resetChat`, `messagesEndRef`, `toolStatus`, `toolSteps`
- `useLanguage()` — `t` (translations), `lang`, `toggleLang`
- `useUser()` — `user`, `token`, `login`, `logout`

## Tool Status → Yoyakun State Mapping

Tool activity drives the character state machine in a `useEffect` on `[messages, isLoading, toolStatus]`:

```
isStreaming           → "talking"
toolStatus = search*  → "searching"
toolStatus = *phone*  → "calling"
isLoading (other)    → "thinking"
last msg has confirm  → "excited" (3s)
last msg has sorry    → "sorry" (2.5s)
search just completed → "found" (2.2s)
default              → "idle"
```

## Session-Level Store (Missing)

Currently, restaurant results exist only within each `MessageBubble` — there is no session-level accumulation. The [[listings-ux-direction]] plan calls for a `useReducer` or React context in this file to aggregate all `search_restaurants` results across the session for the live map panel.

## Scroll Behavior

- `shouldScrollRef` — set to `true` on explicit send; ensures scroll-to-bottom
- `isAtBottomRef` — tracks whether the user is near the bottom; follows streaming if true
- `overflowAnchor: "none"` on the scroll container prevents browser anchor interference

## Book Intent from Other Pages

On mount, reads `yoyaku_book_intent` from `localStorage`, sanitizes it (strips HTML tags, limits to 200 chars), and pre-fills the input. This enables "book this restaurant" flows from restaurant detail pages.

## Intent Tag Builder (Welcome Screen)

The welcome screen has a tag-based query builder:
- **Where:** Near me (triggers geolocation) + named neighborhoods
- **When:** Right now / Tonight / This weekend / Planning ahead
- **Party:** Solo / 2 / 3–4 / 5+
- **Cuisine:** Multi-select (Ramen, Sushi, Yakiniku, etc.)

Selecting tags builds a natural-language prefix in the input field, which the user completes and sends.

## Known Issues

- No React error boundary — any child throw crashes the entire chat silently (see [[security-bug-tracker]])
- `localStorage` called without `typeof window` guard (fragile, currently protected by `"use client"`)

See also: [[yoyakun-ai-concierge]], [[listings-ux-direction]], [[security-bug-tracker]]