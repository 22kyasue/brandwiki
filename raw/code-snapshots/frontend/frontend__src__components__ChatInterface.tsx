<!-- Ingested from: frontend/src/components/ChatInterface.tsx -->
<!-- Mtime: 2026-04-14T15:43:43.044Z -->

"use client";

import { Fragment, useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import MessageBubble from "./MessageBubble";
import { useLanguage } from "./LanguageProvider";
import YoyakunCharacter, { YoyakunState } from "./YoyakunCharacter";
import AuthModal from "./AuthModal";
import BookingHistory from "./BookingHistory";
import UpcomingBookingBanner from "./UpcomingBookingBanner";
import RestaurantPanel from "./RestaurantPanel";
import { useUser } from "@/contexts/UserContext";
import { useStreamingChat, BookingContext, BookingState, CallConfirmation, PendingCall } from "@/hooks/useStreamingChat";
import type { SessionRestaurant } from "./SessionMapInner";

const SessionMap = dynamic(() => import("./SessionMapInner"), { ssr: false, loading: () => null });

const PRICE_LEVEL_MID_MAP: Record<string, number> = { "$": 1000, "$$": 3500, "$$$": 7500, "$$$$": 15000 };

const TOOL_STATUS_LABELS: Record<string, string> = {
  thinking: "Thinking...",
  search_restaurants: "Searching restaurants",
  check_availability: "Checking availability",
  make_reservation: "Making reservation",
  get_restaurant_details: "Loading details",
  get_user_bookings: "Fetching bookings",
  cancel_booking: "Cancelling booking",
  make_phone_reservation: "Calling restaurant",
  check_call_status: "Checking call status",
  modify_reservation: "Modifying reservation",
  save_user_preferences: "Saving preferences",
};

const TOOL_EMOJI: Record<string, string> = {
  search_restaurants: "🔍",
  check_availability: "📅",
  make_reservation: "✅",
  get_restaurant_details: "📋",
  get_user_bookings: "📖",
  cancel_booking: "❌",
  make_phone_reservation: "📞",
  check_call_status: "📲",
  modify_reservation: "✏️",
  save_user_preferences: "💾",
};

const SPEECH_POOLS: Record<YoyakunState, string[]> = {
  idle:      [],
  talking:   ["Here we go~", "Okay okay—", "Oh! So—", "Right, so—", "Got it~", "Mm-hmm—"],
  thinking:  ["Hmm...", "One sec...", "Let me think~", "...", "Thinking~"],
  searching: ["Sniffing around~", "On the trail...", "Scanning the city~", "Hunting something good...", "Nose on the ground~"],
  calling:   ["Dialing...", "Calling now~", "Ringing...", "On hold — hang tight", "Asking for you!"],
  found:     ["Ooh, look at this!", "Found some options~", "Check these out!", "Okay! Got picks~", "Here's what I found!"],
  excited:   ["You're IN!! 🎉", "YES!! Let's go!!", "Table secured!! 🍜", "Booked!!! 💕", "IT'S HAPPENING!! ✨", "Done done done!! 🎉"],
  sorry:     ["Hmm, no luck...", "Ah, sorry...", "That didn't work...", "Hmm... let me try again?", "Whoops, sorry..."],
};

const IDLE_THOUGHTS = [
  "I wonder if that tonkotsu spot is still open...",
  "Hungry yet? 👀",
  "I know some good places~",
  "Good food is out there...",
  "*steam intensifies*",
  "I could really go for tsukemen rn",
  "There's this gyoza spot...",
  "I'm literally made of ramen so just trust me",
  "Late night ramen? Just ask~",
  "Anything from the menu haunting you?",
];

const CONFIRM_WORDS = ["confirmed", "booked", "reservation", "reserved", "予約", "確認"];

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Shinjuku":   { lat: 35.6938, lng: 139.7034 },
  "Shibuya":    { lat: 35.6580, lng: 139.7016 },
  "Ginza":      { lat: 35.6717, lng: 139.7651 },
  "Ikebukuro":  { lat: 35.7295, lng: 139.7109 },
  "Ueno":       { lat: 35.7141, lng: 139.7740 },
  "Nakameguro": { lat: 35.6439, lng: 139.6990 },
  "Sangenjaya": { lat: 35.6433, lng: 139.6706 },
  "Shinbashi":  { lat: 35.6664, lng: 139.7573 },
};

interface TrainStation { name: string; nameJa: string; lat: number; lng: number }
const TRAIN_LINE_STATIONS: Record<string, { nameEn: string; nameJa: string; stations: TrainStation[] }> = {
  yamanote: { nameEn: "Yamanote", nameJa: "山手線", stations: [
    { name: "Shinjuku",   nameJa: "新宿",   lat: 35.6938, lng: 139.7034 },
    { name: "Harajuku",   nameJa: "原宿",   lat: 35.6702, lng: 139.7027 },
    { name: "Shibuya",    nameJa: "渋谷",   lat: 35.6580, lng: 139.7016 },
    { name: "Ebisu",      nameJa: "恵比寿", lat: 35.6466, lng: 139.7101 },
    { name: "Shinbashi",  nameJa: "新橋",   lat: 35.6664, lng: 139.7573 },
    { name: "Akihabara",  nameJa: "秋葉原", lat: 35.6986, lng: 139.7729 },
    { name: "Ueno",       nameJa: "上野",   lat: 35.7141, lng: 139.7774 },
    { name: "Ikebukuro",  nameJa: "池袋",   lat: 35.7295, lng: 139.7109 },
  ]},
  mita: { nameEn: "Mita", nameJa: "三田線", stations: [
    { name: "Meguro",     nameJa: "目黒",   lat: 35.6329, lng: 139.7157 },
    { name: "Shirokanedai", nameJa: "白金台", lat: 35.6406, lng: 139.7228 },
    { name: "Mita",       nameJa: "三田",   lat: 35.6528, lng: 139.7398 },
    { name: "Hibiya",     nameJa: "日比谷", lat: 35.6742, lng: 139.7591 },
    { name: "Otemachi",   nameJa: "大手町", lat: 35.6860, lng: 139.7630 },
    { name: "Jimbocho",   nameJa: "神保町", lat: 35.6963, lng: 139.7570 },
  ]},
  ginza: { nameEn: "Ginza", nameJa: "銀座線", stations: [
    { name: "Shibuya",        nameJa: "渋谷",     lat: 35.6580, lng: 139.7016 },
    { name: "Omotesando",     nameJa: "表参道",   lat: 35.6650, lng: 139.7122 },
    { name: "Akasaka-mitsuke", nameJa: "赤坂見附", lat: 35.6786, lng: 139.7352 },
    { name: "Ginza",          nameJa: "銀座",     lat: 35.6717, lng: 139.7651 },
    { name: "Ueno",           nameJa: "上野",     lat: 35.7141, lng: 139.7774 },
    { name: "Asakusa",        nameJa: "浅草",     lat: 35.7108, lng: 139.7974 },
  ]},
  hibiya: { nameEn: "Hibiya", nameJa: "日比谷線", stations: [
    { name: "Nakameguro", nameJa: "中目黒", lat: 35.6439, lng: 139.6990 },
    { name: "Ebisu",      nameJa: "恵比寿", lat: 35.6466, lng: 139.7101 },
    { name: "Roppongi",   nameJa: "六本木", lat: 35.6604, lng: 139.7294 },
    { name: "Ginza",      nameJa: "銀座",   lat: 35.6717, lng: 139.7651 },
    { name: "Tsukiji",    nameJa: "築地",   lat: 35.6668, lng: 139.7703 },
  ]},
  chuo: { nameEn: "Chuo", nameJa: "中央線", stations: [
    { name: "Kichijoji",  nameJa: "吉祥寺",   lat: 35.7028, lng: 139.5804 },
    { name: "Nakano",     nameJa: "中野",     lat: 35.7072, lng: 139.6659 },
    { name: "Shinjuku",   nameJa: "新宿",     lat: 35.6938, lng: 139.7034 },
    { name: "Yotsuya",    nameJa: "四谷",     lat: 35.6866, lng: 139.7300 },
    { name: "Ochanomizu", nameJa: "御茶ノ水", lat: 35.6997, lng: 139.7659 },
  ]},
  oedo: { nameEn: "Oedo", nameJa: "大江戸線", stations: [
    { name: "Shinjuku",       nameJa: "新宿",       lat: 35.6938, lng: 139.7034 },
    { name: "Roppongi",       nameJa: "六本木",     lat: 35.6604, lng: 139.7294 },
    { name: "Azabu-Juban",    nameJa: "麻布十番",   lat: 35.6555, lng: 139.7368 },
    { name: "Tsukishima",     nameJa: "月島",       lat: 35.6671, lng: 139.7830 },
    { name: "Ryogoku",        nameJa: "両国",       lat: 35.6956, lng: 139.7937 },
  ]},
  toyoko: { nameEn: "Toyoko", nameJa: "東横線", stations: [
    { name: "Shibuya",        nameJa: "渋谷",   lat: 35.6580, lng: 139.7016 },
    { name: "Daikanyama",     nameJa: "代官山", lat: 35.6484, lng: 139.6987 },
    { name: "Nakameguro",     nameJa: "中目黒", lat: 35.6439, lng: 139.6990 },
    { name: "Gakugeidaigaku", nameJa: "学芸大学", lat: 35.6255, lng: 139.6818 },
    { name: "Jiyugaoka",      nameJa: "自由が丘", lat: 35.6083, lng: 139.6678 },
  ]},
};

export default function ChatInterface() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, token, login, logout } = useUser();
  const { messages, isLoading, bookingState, sendMessage, resetChat, messagesEndRef, toolStatus, toolSteps, callConfirmation, clearCallConfirmation, confirmPhoneCall, pendingCall, cancelPendingCall } = useStreamingChat(
    token,
    // When the hook silently refreshes an expired token, persist it via UserContext
    (newToken) => { if (user) login(newToken, user); }
  );

  const [input, setInput] = useState("");
  const [yoyakunState, setYoyakunState] = useState<YoyakunState>("idle");
  const [speechText, setSpeechText] = useState("");
  const [idleThought, setIdleThought] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [intentTags, setIntentTags] = useState<{ location: string[]; when: string[]; size: string[]; cuisine: string[]; budget: string[] }>({ location: [], when: [], size: [], cuisine: [], budget: [] });
  const [trainLine, setTrainLine] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionRestaurants, setSessionRestaurants] = useState<SessionRestaurant[]>([]);
  const [latestBatch, setLatestBatch] = useState<SessionRestaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const ambientIdsRef = useRef<Set<string>>(new Set());
  const lastSearchMsgIdRef = useRef<string>("");
  const [searchRadiusKm, setSearchRadiusKm] = useState(2);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const excitedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLoadingRef = useRef(false);
  const prevToolStatusRef = useRef("");
  const idleThoughtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleThoughtClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => { setMounted(true); }, []);

  // Restore a pending book intent from another page
  useEffect(() => {
    const intent = localStorage.getItem("yoyaku_book_intent");
    if (intent) {
      localStorage.removeItem("yoyaku_book_intent");
      // Sanitize: strip HTML tags and limit length
      const safeIntent = intent.replace(/<[^>]*>/g, "").trim().slice(0, 200);
      if (safeIntent) {
        setInput(`I want to book ${safeIntent}`);
      }
    }
  }, []);

  // Derive Yoyakun state — tool-aware, context-sensitive
  useEffect(() => {
    const isStreaming = messages.some((m) => m.streaming);
    const wasLoading = prevLoadingRef.current;
    const prevTool = prevToolStatusRef.current;
    prevLoadingRef.current = isLoading;
    if (toolStatus) prevToolStatusRef.current = toolStatus;

    if (pendingCall) { setYoyakunState("calling"); return; }
    if (isStreaming) { setYoyakunState("talking"); return; }
    if (isLoading) {
      if (toolStatus === "search_restaurants" || toolStatus === "get_restaurant_details") {
        setYoyakunState("searching");
      } else if (toolStatus === "make_phone_reservation" || toolStatus === "make_reservation") {
        setYoyakunState("calling");
      } else {
        setYoyakunState("thinking");
      }
      return;
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      const content = lastAssistant.content.toLowerCase();
      if (CONFIRM_WORDS.some((w) => content.includes(w))) {
        setYoyakunState("excited");
        if (excitedTimeoutRef.current) clearTimeout(excitedTimeoutRef.current);
        excitedTimeoutRef.current = setTimeout(() => setYoyakunState("idle"), 3000);
        return;
      }
      if (content.includes("sorry") || content.includes("unfortunately") || content.includes("couldn't find") || content.includes("no result")) {
        setYoyakunState("sorry");
        if (excitedTimeoutRef.current) clearTimeout(excitedTimeoutRef.current);
        excitedTimeoutRef.current = setTimeout(() => setYoyakunState("idle"), 2500);
        return;
      }
      if (wasLoading && (prevTool === "search_restaurants" || prevTool === "get_restaurant_details")) {
        setYoyakunState("found");
        if (excitedTimeoutRef.current) clearTimeout(excitedTimeoutRef.current);
        excitedTimeoutRef.current = setTimeout(() => setYoyakunState("idle"), 2200);
        return;
      }
    }
    setYoyakunState("idle");
    return () => { if (excitedTimeoutRef.current) clearTimeout(excitedTimeoutRef.current); };
  }, [messages, isLoading, toolStatus, pendingCall]);

  // Pick a random phrase when state changes
  useEffect(() => {
    const pool = SPEECH_POOLS[yoyakunState];
    if (pool && pool.length > 0) {
      setSpeechText(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      setSpeechText("");
    }
  }, [yoyakunState]);

  // Idle thoughts — fire unprompted after silence
  useEffect(() => {
    if (yoyakunState !== "idle") {
      setIdleThought(null);
      if (idleThoughtTimerRef.current) clearTimeout(idleThoughtTimerRef.current);
      if (idleThoughtClearRef.current) clearTimeout(idleThoughtClearRef.current);
      return;
    }
    const scheduleThought = () => {
      const delay = 12000 + Math.random() * 18000;
      idleThoughtTimerRef.current = setTimeout(() => {
        const thought = IDLE_THOUGHTS[Math.floor(Math.random() * IDLE_THOUGHTS.length)];
        setIdleThought(thought);
        idleThoughtClearRef.current = setTimeout(() => {
          setIdleThought(null);
          scheduleThought();
        }, 4500);
      }, delay);
    };
    scheduleThought();
    return () => {
      if (idleThoughtTimerRef.current) clearTimeout(idleThoughtTimerRef.current);
      if (idleThoughtClearRef.current) clearTimeout(idleThoughtClearRef.current);
    };
  }, [yoyakunState]);

  // Replace restaurant list whenever a new search_restaurants result arrives
  useEffect(() => {
    // Find the latest message that has a search_restaurants tool call
    let latestSearchMsg: (typeof messages)[0] | undefined;
    for (const message of messages) {
      if (message.toolCalls?.some((tc) => tc?.name === "search_restaurants")) {
        latestSearchMsg = message;
      }
    }
    if (!latestSearchMsg || latestSearchMsg.id === lastSearchMsgIdRef.current) return;
    lastSearchMsgIdRef.current = latestSearchMsg.id;

    const tc = latestSearchMsg.toolCalls!.find((tc) => tc?.name === "search_restaurants");
    if (!tc) return;
    const result = tc.result as { restaurants?: SessionRestaurant[] };
    const fresh = (result?.restaurants ?? []).filter((r) => r.location?.lat && r.location?.lng);

    // Replace entirely — wipe old results, ambient set, and current selection
    seenIdsRef.current.clear();
    ambientIdsRef.current.clear();
    fresh.forEach((r) => seenIdsRef.current.add(r.id));
    setSessionRestaurants(fresh);
    setLatestBatch(fresh);
    setSelectedRestaurantId(null);
  }, [messages]);

  // Ambient tag search — fires immediately when tags change, results trickle in per-cuisine
  const ambientCtrlRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const cuisines = intentTags.cuisine;
    const locations = intentTags.location.filter((l) => l !== "near me");
    const hasNearMe = intentTags.location.includes("near me");
    const anyChip = cuisines.length > 0 || locations.length > 0 || hasNearMe ||
      intentTags.budget.length > 0 || intentTags.when.length > 0 || intentTags.size.length > 0 ||
      trainLine !== null;
    // Nothing selected — wipe results instantly.
    if (!anyChip) {
      ambientCtrlRef.current?.abort();
      seenIdsRef.current.clear();
      ambientIdsRef.current.clear();
      setSessionRestaurants([]);
      setLatestBatch([]);
      setSelectedRestaurantId(null);
      return;
    }
    // "near me" without GPS — wait for grant.
    if (hasNearMe && !userLocation && cuisines.length === 0 && locations.length === 0 && !trainLine) return;

    // Cancel any previous in-flight ambient fetches
    ambientCtrlRef.current?.abort();
    const ctrl = new AbortController();
    ambientCtrlRef.current = ctrl;

    // Clear ALL restaurants so stale results (ambient or Claude) don't linger on tag change
    seenIdsRef.current.clear();
    ambientIdsRef.current.clear();
    setSessionRestaurants([]);
    setLatestBatch([]);
    setSelectedRestaurantId(null);

    // Train line mode — fire one search per key station (1 km radius each)
    if (trainLine) {
      const lineData = TRAIN_LINE_STATIONS[trainLine];
      if (lineData) {
        const cuisine = cuisines[0]; // apply first cuisine filter if any
        lineData.stations.forEach(async (station) => {
          try {
            const qs = new URLSearchParams({ area: station.name, limit: "5", radiusKm: "1" });
            qs.set("lat", String(station.lat));
            qs.set("lng", String(station.lng));
            if (cuisine) qs.set("cuisine", cuisine);
            const res = await fetch(`/api/restaurants?${qs.toString()}`, { signal: ctrl.signal });
            if (!res.ok) return;
            const data = (await res.json()) as Array<{
              id: string; name: string; nameJa?: string; address: string;
              lat?: number; lng?: number; rating?: number; tabelogRating?: number; googleRating?: number;
              ratingCount?: number; priceLevel?: string; priceRange?: string; openNow?: boolean;
              cuisine?: string[]; photoUrl?: string; hasOnlineBooking?: boolean; tabelogUrl?: string;
              awards?: string[];
            }>;
            const newOnes = data.filter((r) => r.lat && r.lng && !seenIdsRef.current.has(r.id));
            if (newOnes.length === 0) return;
            const mapped: SessionRestaurant[] = newOnes.map((r) => ({
              id: r.id, name: r.name, nameJa: r.nameJa, address: r.address,
              rating: r.rating, tabelogRating: r.tabelogRating, googleRating: r.googleRating,
              ratingCount: r.ratingCount, priceLevel: r.priceLevel, priceRange: r.priceRange,
              openNow: r.openNow, cuisine: Array.isArray(r.cuisine) ? r.cuisine : [],
              photoUrl: r.photoUrl, location: { lat: r.lat!, lng: r.lng! },
              hasOnlineBooking: r.hasOnlineBooking ?? false, tabelogUrl: r.tabelogUrl, awards: r.awards,
            }));
            newOnes.forEach((r) => { seenIdsRef.current.add(r.id); ambientIdsRef.current.add(r.id); });
            setSessionRestaurants((prev) => [...prev, ...mapped]);
            setLatestBatch(mapped);
          } catch { /* aborted or network error */ }
        });
        return () => ctrl.abort();
      }
    }

    const area = locations[0] ?? "Tokyo";
    // "near me" uses actual GPS; named locations use pre-defined coords
    const areaCoords = hasNearMe && userLocation
      ? userLocation
      : (area !== "Tokyo" ? LOCATION_COORDS[area] : null);
    // Cap parallel queries to 3 cuisines max to avoid flooding
    const queries = (cuisines.length > 0 ? cuisines : [""]).slice(0, 3);

    // Fire one fetch per cuisine — results appear as each one lands
    queries.forEach(async (cuisine) => {
      try {
        const qs = new URLSearchParams({ area, limit: "5", radiusKm: String(searchRadiusKm) });
        if (areaCoords) { qs.set("lat", String(areaCoords.lat)); qs.set("lng", String(areaCoords.lng)); }
        if (cuisine) qs.set("cuisine", cuisine);
        const res = await fetch(`/api/restaurants?${qs.toString()}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: string; name: string; nameJa?: string; address: string;
          lat?: number; lng?: number; rating?: number; tabelogRating?: number; googleRating?: number;
          ratingCount?: number; priceLevel?: string; priceRange?: string; openNow?: boolean;
          cuisine?: string[]; photoUrl?: string; hasOnlineBooking?: boolean; tabelogUrl?: string;
          awards?: string[];
        }>;
        const newOnes = data.filter((r) => r.lat && r.lng && !seenIdsRef.current.has(r.id));
        if (newOnes.length === 0) return;
        const mapped: SessionRestaurant[] = newOnes.map((r) => ({
          id: r.id, name: r.name, nameJa: r.nameJa, address: r.address,
          rating: r.rating, tabelogRating: r.tabelogRating, googleRating: r.googleRating,
          ratingCount: r.ratingCount,
          priceLevel: r.priceLevel, priceRange: r.priceRange,
          openNow: r.openNow,
          cuisine: Array.isArray(r.cuisine) ? r.cuisine : [],
          photoUrl: r.photoUrl,
          location: { lat: r.lat!, lng: r.lng! },
          hasOnlineBooking: r.hasOnlineBooking ?? false, tabelogUrl: r.tabelogUrl,
          awards: r.awards,
        }));
        newOnes.forEach((r) => {
          seenIdsRef.current.add(r.id);
          ambientIdsRef.current.add(r.id);
        });
        setSessionRestaurants((prev) => [...prev, ...mapped]);
        setLatestBatch(mapped);
      } catch { /* aborted or network error */ }
    });

    return () => ctrl.abort();
  }, [intentTags.cuisine, intentTags.location, intentTags.budget, intentTags.when, intentTags.size, searchRadiusKm, userLocation, trainLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom: on explicit send, or whenever the user is already at the bottom (follows streaming)
  const shouldScrollRef = useRef(false);
  useEffect(() => {
    if (!shouldScrollRef.current && !isAtBottomRef.current) return;
    shouldScrollRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);


  const budgetRange: [number, number] | null =
    intentTags.budget.includes("under ¥1000 per person")    ? [0, 1000] :
    intentTags.budget.includes("¥1000–2000 per person")     ? [1000, 2000] :
    intentTags.budget.includes("¥2000–5000 per person")     ? [2000, 5000] :
    intentTags.budget.includes("¥5000–10000 per person")    ? [5000, 10000] :
    intentTags.budget.includes("¥10000+ per person")        ? [10000, Infinity] : null;

  const mapRestaurants = useMemo(() => {
    if (!budgetRange) return sessionRestaurants;
    const [lo, hi] = budgetRange;
    return sessionRestaurants.filter((r) => {
      if (r.priceLevel) {
        const mid = PRICE_LEVEL_MID_MAP[r.priceLevel] ?? 3500;
        return mid >= lo && mid < hi;
      }
      if (r.priceRange) {
        const nums = r.priceRange.match(/\d[\d,]*/g)?.map((s) => parseInt(s.replace(/,/g, ""), 10)) ?? [];
        if (nums.length === 0) return true;
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return avg >= lo && avg < hi;
      }
      return true;
    });
  }, [sessionRestaurants, budgetRange]);

  const toggleTag = (group: keyof typeof intentTags, value: string) => {
    if (group === "location") setSearchRadiusKm(2);
    setIntentTags((prev) => {
      const arr = prev[group] as string[];
      const next = { ...prev, [group]: arr.includes(value) ? arr.filter((c) => c !== value) : [...arr, value] };
      const parts = [
        next.location.join(" or "),
        next.when.join(" or "),
        next.size.join(" or "),
        next.cuisine.join(" or "),
        next.budget.join(" or "),
      ].filter(Boolean);
      setInput(parts.length > 0 ? parts.join(", ") + " — " : "");
      setTimeout(() => inputRef.current?.focus(), 0);
      return next;
    });
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setLocationStatus("granted");
        setFocusLocation({ lat, lng, zoom: 14 });
        // Fire background seed for this user's nearest area — no await, no blocking
        fetch("/api/seed-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        }).catch(() => {});
      },
      () => setLocationStatus("denied")
    );
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    shouldScrollRef.current = true;
    isAtBottomRef.current = true;
    setInput("");
    clearCallConfirmation();
    setIntentTags({ location: [], when: [], size: [], cuisine: [], budget: [] });
    setTrainLine(null);
    if (inputRef.current) inputRef.current.style.height = "";
    const activeRestaurant = selectedRestaurantId
      ? sessionRestaurants.find((r) => r.id === selectedRestaurantId) ?? undefined
      : undefined;
    await sendMessage(text, userLocation ?? undefined, activeRestaurant as Record<string, unknown> | undefined, lang);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Layer 0: Full-screen map background */}
      <div className="fixed inset-0 z-0">
        <SessionMap
          restaurants={mapRestaurants}
          latestBatch={latestBatch}
          focusLocation={focusLocation}
          selectedId={selectedRestaurantId}
          onPinClick={(id) => { setSelectedRestaurantId(id); }}
        />
      </div>

      {/* History drawer — always mounted, slides in/out */}
      <div
        className={`fixed inset-0 z-30 transition-[background-color] duration-300 ${showHistory ? "bg-black/20 pointer-events-auto" : "bg-transparent pointer-events-none"}`}
        onClick={() => setShowHistory(false)}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--surface-0)] border-r border-[var(--surface-border)] flex flex-col shadow-2xl transition-transform duration-300 ease-out"
          style={{ transform: showHistory ? "translateX(0)" : "translateX(-100%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
            <span className="text-sm font-semibold text-[var(--text-1)]">History</span>
            <button onClick={() => setShowHistory(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors btn-press">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <BookingHistory onSignIn={() => { setShowHistory(false); setShowAuthModal(true); }} />
          <div className="flex-shrink-0 border-t border-[var(--surface-border)] p-3 flex flex-col gap-1">
            {user && <Link href="/profile" onClick={() => setShowHistory(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"><span>👤</span>{user.name}</Link>}
            <Link href="/bookings" onClick={() => setShowHistory(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"><span>📅</span>{t.header.bookings}</Link>
            <Link href="/room/create" onClick={() => setShowHistory(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"><span>👥</span>Group</Link>
            {user?.role === "restaurant_owner" && <Link href="/owner" onClick={() => setShowHistory(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"><span>🏪</span>Owner portal</Link>}
          </div>
        </div>
      </div>

      {/* Layer 1: Chat panel — fixed left, frosted glass */}
      <div className="fixed left-0 top-0 bottom-0 w-[440px] z-10 flex flex-col panel-glass border-r border-[var(--surface-border)]/50 rounded-r-[28px] overflow-hidden">
          {/* Header */}
          <header className="border-b border-[var(--surface-border)] px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(true)}
                  title="Menu"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-3)] hover:text-accent hover:bg-accent/8 transition-colors btn-press"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                </button>
                <button
                  onClick={() => { resetChat(); setInput(""); setIntentTags({ location: [], when: [], size: [], cuisine: [], budget: [] }); setTrainLine(null); mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
                  title="Reset chat"
                  className="text-left btn-press"
                >
                  <h1 className="text-base font-bold text-[var(--text-1)] leading-tight">{t.header.title}</h1>
                  <p className="text-[11px] text-[var(--text-3)]">{t.header.subtitle}</p>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLang}
                  className="px-2.5 py-1 text-xs font-medium text-[var(--text-2)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  title="Switch language / 言語切替"
                >
                  {lang === "en" ? "日本語" : "English"}
                </button>
                {user ? (
                  <button
                    onClick={logout}
                    className="px-2.5 py-1 text-xs font-medium text-[var(--text-2)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-3.5 py-1.5 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent-hover btn-press transition-colors shadow-sm"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </header>
          <UpcomingBookingBanner />
          <div className={`h-0.5 bg-accent ${isLoading ? "animate-pulse" : "opacity-0"} transition-opacity duration-300`} />
          <BookingProgressBar state={bookingState.state} />

          {/* Messages */}
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto px-4 py-6"
            style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}
            onScroll={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              setShowScrollTop(el.scrollTop > 320);
            }}
          >
            <div className={messages.length > 0 ? "pb-40" : ""}>
              {messages.length === 0 ? (
                <div className="text-center pt-6 pb-2">
                  <div className="flex flex-col items-center mb-2">
                    <div className="relative">
                      <div className="absolute inset-[-40px] rounded-full bg-accent/20 dark:bg-accent/25 blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
                      <div key={yoyakunState} className="yoya-state-enter">
                        <YoyakunCharacter state={yoyakunState} size={140} />
                      </div>
                    </div>
                    <div
                      className="mt-3 bg-[var(--surface-1)] border border-[var(--surface-border)] rounded-2xl px-4 py-2 text-sm text-[var(--text-1)] shadow-sm font-medium"
                      style={{
                        visibility: (yoyakunState !== "idle" || idleThought) ? "visible" : "hidden",
                        opacity: (yoyakunState !== "idle" || idleThought) ? 1 : 0,
                        transition: "opacity 180ms ease",
                      }}
                    >
                      {speechText || idleThought || "\u00A0"}
                    </div>
                  </div>
                  <h2 className="text-3xl mb-2 text-[var(--text-1)]" style={{ fontFamily: "var(--font-display)", fontWeight: 400, letterSpacing: "-0.01em" }}>
                    {t.chat.welcome}
                  </h2>
                  <p className="text-base text-[var(--text-2)] mb-3 max-w-sm mx-auto leading-relaxed">
                    {t.chat.welcomeSubtitle}
                  </p>

                  {mounted && <><div className="w-full max-w-4xl mx-auto mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-left">

                    {/* Location — full width, "Near me" first */}
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-2 pl-1">{t.chips.where}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { handleRequestLocation(); toggleTag("location", "near me"); }}
                          className={`btn-press flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${intentTags.location.includes("near me") ? "bg-accent border-accent text-white shadow-sm" : "bg-[var(--surface-1)] dark:bg-[var(--surface-2)] border-[var(--surface-border)] text-[var(--text-2)] hover:border-accent/40 hover:text-accent"}`}
                        >
                          {locationStatus === "loading" ? t.chips.locating : locationStatus === "granted" && intentTags.location.includes("near me") ? t.chips.nearMeOk : t.chips.nearMe}
                        </button>
                        {(["Shinjuku", "Shibuya", "Ginza", "Ikebukuro", "Ueno", "Nakameguro", "Sangenjaya", "Shinbashi"] as const).map((v, i) => (
                          <button key={v} onClick={() => { toggleTag("location", v); const c = LOCATION_COORDS[v]; if (c) setFocusLocation({ ...c, zoom: 14 }); }}
                            className={`btn-press flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${intentTags.location.includes(v) ? "bg-accent border-accent text-white shadow-sm" : "bg-[var(--surface-1)] dark:bg-[var(--surface-2)] border-[var(--surface-border)] text-[var(--text-2)] hover:border-accent/40 hover:text-accent"}`}
                          >{t.chips.locationLabels[i]}</button>
                        ))}
                      </div>
                      {intentTags.location.some((l) => l !== "near me" && LOCATION_COORDS[l]) && (
                        <div className="flex items-center gap-2 mt-2 pl-1">
                          <span className="text-[11px] text-[var(--text-3)]">{t.chips.within} {searchRadiusKm}km</span>
                          {searchRadiusKm < 10 && (
                            <button
                              onClick={() => setSearchRadiusKm((r) => r === 2 ? 5 : 10)}
                              className="btn-press text-[11px] px-2 py-0.5 rounded-lg border border-[var(--surface-border)] text-[var(--text-2)] hover:border-accent/40 hover:text-accent transition-colors"
                            >
                              {t.chips.expandTo} {searchRadiusKm === 2 ? 5 : 10}{t.chips.km}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cuisine — always visible, drives ambient search */}
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-2 pl-1">{t.chips.cuisine}</p>
                      <div className="flex flex-wrap gap-2">
                        {(["Ramen", "Sushi", "Yakiniku", "Korean BBQ", "Izakaya", "Gyukatsu", "Tempura", "Omakase"] as const).map((v, i) => (
                          <button key={v} onClick={() => toggleTag("cuisine", v)}
                            className={`btn-press flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${intentTags.cuisine.includes(v) ? "bg-accent border-accent text-white shadow-sm" : "bg-[var(--surface-1)] dark:bg-[var(--surface-2)] border-[var(--surface-border)] text-[var(--text-2)] hover:border-accent/40 hover:text-accent"}`}
                          >{t.chips.cuisineLabels[i]}</button>
                        ))}
                      </div>
                    </div>

                    {/* Train line */}
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-2 pl-1">{t.chips.trainLine}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(TRAIN_LINE_STATIONS).map(([key, line]) => (
                          <button key={key}
                            onClick={() => { setTrainLine(trainLine === key ? null : key); if (trainLine !== key) setIntentTags((prev) => ({ ...prev, location: [] })); }}
                            className={`btn-press flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${trainLine === key ? "bg-accent border-accent text-white shadow-sm" : "bg-[var(--surface-1)] dark:bg-[var(--surface-2)] border-[var(--surface-border)] text-[var(--text-2)] hover:border-accent/40 hover:text-accent"}`}
                          >{lang === "ja" ? line.nameJa : line.nameEn}</button>
                        ))}
                      </div>
                    </div>

                    {/* When — right now / tonight always visible; rest behind more options */}
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-2 pl-1">{t.chips.when}</p>
                      <div className="flex flex-wrap gap-2">
                        {(["right now", "tonight"] as const).map((value, i) => (
                          <button key={value} onClick={() => toggleTag("when", value)}
                            className={`btn-press flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${intentTags.when.includes(value) ? "bg-accent border-accent text-white shadow-sm" : "bg-[var(--surface-1)] dark:bg-[var(--surface

[... truncated ...]