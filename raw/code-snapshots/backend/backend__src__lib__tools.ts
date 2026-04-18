<!-- Ingested from: backend/src/lib/tools.ts -->
<!-- Mtime: 2026-04-14T14:48:25.773Z -->

import { searchRestaurants, getRestaurantDetails } from "./google-places";
import { searchScrapedRestaurants, getScrapedRestaurantDetails, checkTabelogAvailability, makeTabelogReservation, searchTabelogLive } from "./scraper";
import prisma from "./db";
import { lookupAwards } from "./awards";
import { Prisma } from "@prisma/client";
import { TimeSlot, BookingRequest, Restaurant, RestaurantDetails } from "../types";
import { sendBookingConfirmation, sendBookingModification } from "./email";
import { sendBookingConfirmationSMS } from "./sms";
import { upsertUserPreferences } from "./preferences";
import { initiatePhoneCall, getCallStatus as getAutocallStatus } from "./autocall";

// ---------------------------------------------------------------------------
// In-memory TTL caches — avoids redundant DB/scraper/API hits within a session
// ---------------------------------------------------------------------------
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const searchCache = new Map<string, { ts: number; value: unknown }>();
const detailsCache = new Map<string, { ts: number; value: unknown }>();

function cacheGet<T>(cache: Map<string, { ts: number; value: T }>, key: string, ttl: number): T | undefined {
  const entry = cache.get(key) as { ts: number; value: T } | undefined;
  if (!entry || Date.now() - entry.ts > ttl) return undefined;
  return entry.value;
}
function cacheSet<T>(cache: Map<string, { ts: number; value: T }>, key: string, value: T): void {
  cache.set(key, { ts: Date.now(), value });
}

type RestaurantWithBookingLinks = Restaurant & { tabelogUrl?: string; bookingUrl?: string; ratingCount?: number; priceRange?: string; hasOnlineBooking?: boolean };

// Key dining stations per Tokyo train line — used by the train_line search param
const TRAIN_LINE_STATIONS: Record<string, { nameEn: string; nameJa: string; stations: Array<{name: string; nameJa: string; lat: number; lng: number}> }> = {
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
    { name: "Meguro",       nameJa: "目黒",   lat: 35.6329, lng: 139.7157 },
    { name: "Shirokanedai", nameJa: "白金台", lat: 35.6406, lng: 139.7228 },
    { name: "Mita",         nameJa: "三田",   lat: 35.6528, lng: 139.7398 },
    { name: "Hibiya",       nameJa: "日比谷", lat: 35.6742, lng: 139.7591 },
    { name: "Otemachi",     nameJa: "大手町", lat: 35.6860, lng: 139.7630 },
    { name: "Jimbocho",     nameJa: "神保町", lat: 35.6963, lng: 139.7570 },
  ]},
  ginza: { nameEn: "Ginza", nameJa: "銀座線", stations: [
    { name: "Shibuya",          nameJa: "渋谷",     lat: 35.6580, lng: 139.7016 },
    { name: "Omotesando",       nameJa: "表参道",   lat: 35.6650, lng: 139.7122 },
    { name: "Akasaka-mitsuke",  nameJa: "赤坂見附", lat: 35.6786, lng: 139.7352 },
    { name: "Ginza",            nameJa: "銀座",     lat: 35.6717, lng: 139.7651 },
    { name: "Ueno",             nameJa: "上野",     lat: 35.7141, lng: 139.7774 },
    { name: "Asakusa",          nameJa: "浅草",     lat: 35.7108, lng: 139.7974 },
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
    { name: "Shinjuku",    nameJa: "新宿",     lat: 35.6938, lng: 139.7034 },
    { name: "Roppongi",    nameJa: "六本木",   lat: 35.6604, lng: 139.7294 },
    { name: "Azabu-Juban", nameJa: "麻布十番", lat: 35.6555, lng: 139.7368 },
    { name: "Tsukishima",  nameJa: "月島",     lat: 35.6671, lng: 139.7830 },
    { name: "Ryogoku",     nameJa: "両国",     lat: 35.6956, lng: 139.7937 },
  ]},
  toyoko: { nameEn: "Toyoko", nameJa: "東横線", stations: [
    { name: "Shibuya",        nameJa: "渋谷",     lat: 35.6580, lng: 139.7016 },
    { name: "Daikanyama",     nameJa: "代官山",   lat: 35.6484, lng: 139.6987 },
    { name: "Nakameguro",     nameJa: "中目黒",   lat: 35.6439, lng: 139.6990 },
    { name: "Gakugeidaigaku", nameJa: "学芸大学", lat: 35.6255, lng: 139.6818 },
    { name: "Jiyugaoka",      nameJa: "自由が丘", lat: 35.6083, lng: 139.6678 },
  ]},
};

const CUISINE_PHOTO_FALLBACKS: Array<[RegExp, string]> = [
  [/sushi|omakase/i, "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=200&fit=crop"],
  [/ramen|noodle/i, "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&h=200&fit=crop"],
  [/italian|pasta|pizza/i, "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=200&fit=crop"],
  [/yakiniku|bbq|barbecue|grill/i, "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=200&fit=crop"],
  [/tempura|tonkatsu|fry/i, "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=400&h=200&fit=crop"],
  [/french|bistro/i, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=200&fit=crop"],
  [/chinese|dim.?sum|cantonese/i, "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&h=200&fit=crop"],
  [/japanese|washoku/i, "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=200&fit=crop"],
];

function getCuisinePhotoFallback(cuisine: string[] | string | undefined): string {
  const cuisineStr = Array.isArray(cuisine) ? cuisine.join(" ") : (cuisine ?? "");
  for (const [pattern, url] of CUISINE_PHOTO_FALLBACKS) {
    if (pattern.test(cuisineStr)) return url;
  }
  return "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=200&fit=crop";
}
type RestaurantDetailsWithBookingLinks = RestaurantDetails & { tabelogUrl?: string; bookingUrl?: string };
type AvailabilitySource = "tabelog" | "phone_only";

interface NearbyAlternativeSuggestion {
  restaurantId: string;
  restaurantName: string;
  cuisine: string;
  availableTime: string;
  distanceMeters?: number;
  source: AvailabilitySource;
  message: string;
}

interface AvailabilityResult {
  restaurantName: string;
  date: string;
  partySize: number;
  availableSlots: TimeSlot[];
  source: AvailabilitySource;
  requestedTime?: string;
  exactTimeAvailable?: boolean;
  fallbackMessage?: string;
  alternativeSuggestion?: NearbyAlternativeSuggestion;
}

// Tool execution handlers
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  switch (toolName) {
    case "search_restaurants":
      return handleSearchRestaurants(toolInput);
    case "get_restaurant_details":
      return handleGetRestaurantDetails(toolInput);
    case "check_availability":
      return handleCheckAvailability(toolInput);
    case "make_reservation":
      return handleMakeReservation(toolInput, userId);
    case "get_user_bookings":
      return handleGetUserBookings(toolInput, userId);
    case "cancel_booking":
      return handleCancelBooking(toolInput);
    case "modify_reservation":
      return handleModifyReservation(toolInput);
    case "make_phone_reservation":
      return handleMakePhoneCall(toolInput, userId);
    case "check_call_status":
      return handleGetCallStatus(toolInput);
    case "save_user_preferences":
      return handleSaveUserPreferences(toolInput, userId);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function splitLocationParts(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// Maps Tokyo/Osaka neighborhoods to their broader ward/area for DB fallback searches
const NEIGHBORHOOD_TO_AREA: Record<string, string> = {
  hongo: "Bunkyo",
  koishikawa: "Bunkyo",
  suidobashi: "Bunkyo",
  yanaka: "Ueno",
  nezu: "Ueno",
  sendagi: "Ueno",
  kagurazaka: "Shinjuku",
  koenji: "Shinjuku",
  kabukicho: "Shinjuku",
  shimokitazawa: "Shibuya",
  nakameguro: "Shibuya",
  daikanyama: "Shibuya",
  ebisu: "Shibuya",
  jiyugaoka: "Meguro",
  meguro: "Shibuya",
  azabu: "Roppongi",
  nishiazabu: "Roppongi",
  higashiazabu: "Roppongi",
  hiroo: "Roppongi",
  minami_aoyama: "Aoyama",
  kitaaoyama: "Aoyama",
  shinbashi: "Ginza",
  shimbashi: "Ginza",
  toranomon: "Ginza",
  yurakucho: "Ginza",
  marunouchi: "Ginza",
  kanda: "Akihabara",
  ochanomizu: "Akihabara",
  akihabara: "Akihabara",
};

function buildBroaderLocationQueries(location: string): string[] {
  const parts = splitLocationParts(location);
  const queries: string[] = [];

  for (let index = 1; index < parts.length; index++) {
    const relaxedLocation = parts.slice(index).join(", ");
    if (relaxedLocation) {
      queries.push(relaxedLocation);
    }
  }

  // For single-word neighborhoods, try their broader area then the city
  if (parts.length === 1) {
    const key = parts[0].toLowerCase().replace(/\s+/g, "_");
    const broaderArea = NEIGHBORHOOD_TO_AREA[key];
    if (broaderArea) queries.push(broaderArea);
    // City-level final fallback — catches everything in the mock + real DB
    const city = /osaka|kyoto|nagoya|sapporo|fukuoka/i.test(parts[0]) ? parts[0] : "Tokyo";
    queries.push(city);
  }

  return [...new Set(queries)];
}

function deriveLocationFromAddress(address?: string): string | undefined {
  const parts = splitLocationParts(address);
  if (parts.length >= 2) {
    return parts.slice(-2).join(", ");
  }
  return parts[0];
}

function normalizeTime(value?: string): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) return undefined;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "00");
  const meridiem = match[3]?.toLowerCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return undefined;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return undefined;
    }
    if (hours === 12) {
      hours = 0;
    }
    if (meridiem === "pm") {
      hours += 12;
    }
  } else if (hours > 23) {
    return undefined;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function shiftTimeByMinutes(time: string, deltaMinutes: number): string {
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = (((hours * 60) + minutes + deltaMinutes) % 1440 + 1440) % 1440;
  const shiftedHours = Math.floor(totalMinutes / 60);
  const shiftedMinutes = totalMinutes % 60;
  return `${shiftedHours.toString().padStart(2, "0")}:${shiftedMinutes.toString().padStart(2, "0")}`;
}

function hasCoordinates(location?: { lat: number; lng: number }): boolean {
  if (!location) return false;
  return Number.isFinite(location.lat) && Number.isFinite(location.lng) && !(location.lat === 0 && location.lng === 0);
}

function calculateDistanceMeters(
  origin?: { lat: number; lng: number },
  target?: { lat: number; lng: number }
): number | undefined {
  if (!hasCoordinates(origin) || !hasCoordinates(target)) {
    return undefined;
  }

  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians((target?.lat ?? 0) - (origin?.lat ?? 0));
  const deltaLng = toRadians((target?.lng ?? 0) - (origin?.lng ?? 0));
  const lat1 = toRadians(origin?.lat ?? 0);
  const lat2 = toRadians(target?.lat ?? 0);

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function namesSimilar(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function dedupeRestaurants<T extends { id: string }>(restaurants: T[]): T[] {
  const seen = new Set<string>();
  return restaurants.filter((restaurant) => {
    if (seen.has(restaurant.id)) {
      return false;
    }
    seen.add(restaurant.id);
    return true;
  });
}


function pickCuisineLabel(
  cuisine: string[] | string | undefined,
  fallbackCuisine?: string
): string {
  if (Array.isArray(cuisine)) {
    const preferred = cuisine.find((item) => item && item.toLowerCase() !== "restaurant");
    if (preferred) {
      return preferred;
    }
  } else if (typeof cuisine === "string" && cuisine.trim()) {
    return cuisine.trim();
  }

  if (fallbackCuisine?.trim()) {
    return fallbackCuisine.trim();
  }

  return "similar cuisine";
}

function selectSuggestedTime(availableSlots: TimeSlot[], requestedTime?: string): string | undefined {
  if (availableSlots.length === 0) {
    return undefined;
  }

  if (!requestedTime) {
    return availableSlots[0]?.time;
  }

  const preferredTimes = [
    requestedTime,
    shiftTimeByMinutes(requestedTime, -30),
    shiftTimeByMinutes(requestedTime, 30),
  ];

  for (const preferredTime of [...new Set(preferredTimes)]) {
    const matchingSlot = availableSlots.find((slot) => normalizeTime(slot.time) === preferredTime);
    if (matchingSlot) {
      return matchingSlot.time;
    }
  }

  return undefined;
}

function isRequestedTimeAvailable(availableSlots: TimeSlot[], requestedTime?: string): boolean {
  if (!requestedTime) {
    return availableSlots.length > 0;
  }

  return availableSlots.some((slot) => normalizeTime(slot.time) === requestedTime);
}

async function loadRestaurantDetails(
  restaurantId?: string
): Promise<RestaurantDetailsWithBookingLinks | null> {
  if (!restaurantId) {
    return null;
  }

  const cached = cacheGet<RestaurantDetailsWithBookingLinks>(detailsCache as Map<string, { ts: number; value: RestaurantDetailsWithBookingLinks }>, restaurantId, DETAIL_CACHE_TTL_MS);
  if (cached) return cached;

  const scrapedDetails = await getScrapedRestaurantDetails(restaurantId);
  if (scrapedDetails) {
    cacheSet(detailsCache as Map<string, { ts: number; value: RestaurantDetailsWithBookingLinks }>, restaurantId, scrapedDetails);
    return scrapedDetails;
  }

  try {
    const details = await getRestaurantDetails(restaurantId);
    cacheSet(detailsCache as Map<string, { ts: number; value: RestaurantDetailsWithBookingLinks }>, restaurantId, details);
    return details;
  } catch {
    return null;
  }
}

async function getAvailabilitySnapshot(params: {
  date: string;
  partySize: number;
  restaurantId?: string;
  tabelogUrl?: string;
}): Promise<{ availableSlots: TimeSlot[]; source: AvailabilitySource }> {
  if (params.restaurantId) {
    try {
      let tabelogUrl = params.tabelogUrl;

      if (!tabelogUrl) {
        const details = await getScrapedRestaurantDetails(params.restaurantId);
        tabelogUrl = (details as { tabelogUrl?: string } | null)?.tabelogUrl;
      }

      if (tabelogUrl) {
        const TABELOG_DEADLINE_MS = 2000;
        const timeoutResult = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), TABELOG_DEADLINE_MS)
        );
        const tabelogResult = checkTabelogAvailability({
          tabelogUrl,
          date: params.date,
          partySize: params.partySize,
          restaurantId: params.restaurantId,
        });
        const winner = await Promise.race([tabelogResult, timeoutResult]);
        if (winner !== null) {
          return {
            availableSlots: winner.slots.map((slot) => ({ time: slot.time, available: true })),
            source: "tabelog",
          };
        }
        console.warn("[tools] Tabelog timed out after 5s — phone_only");
      }
    } catch (err) {
      console.warn("[tools] Tabelog availability check failed — phone_only:", err);
    }
  }

  return {
    availableSlots: [],
    source: "phone_only",
  };
}

async function findRelaxedSearchFallback(params: {
  location: string;
  cuisine?: string;
  priceLevel?: number;
  openNow?: boolean;
}): Promise<{ results: RestaurantWithBookingLinks[]; relaxedLocation?: string }> {
  const locationQueries = buildBroaderLocationQueries(params.location).slice(0, 3); // max 3 fallback attempts
  for (const relaxedLocation of locationQueries) {
    let fallbackResults = await searchScrapedRestaurants({
      location: relaxedLocation,
      cuisine: params.cuisine,
      priceLevel: params.priceLevel,
      hasBooking: true,
    });

    if (fallbackResults.length === 0) {
      fallbackResults = await searchRestaurants({
        location: relaxedLocation,
        cuisine: params.cuisine,
        priceLevel: params.priceLevel,
        openNow: params.openNow,
        radius: 10000,
      });
    }

    if (fallbackResults.length > 0) {
      return {
        results: dedupeRestaurants(fallbackResults).slice(0, 10),
        relaxedLocation,
      };
    }
  }

  return { results: [] };
}

async function findNearbyAvailabilitySuggestion(params: {
  originRestaurantId?: string;
  requestedTime?: string;
  date: string;
  partySize: number;
  locationHint?: string;
  cuisine?: string;
  originDetails?: RestaurantDetailsWithBookingLinks | null;
}): Promise<NearbyAlternativeSuggestion | null> {
  const locationQueries = new Set<string>();
  const normalizedRequestedTime = normalizeTime(params.requestedTime);

  if (params.locationHint) {
    locationQueries.add(params.locationHint);
    for (const relaxedLocation of buildBroaderLocationQueries(params.locationHint)) {
      locationQueries.add(relaxedLocation);
    }
  }

  const derivedLocation = deriveLocationFromAddress(params.originDetails?.address);
  if (derivedLocation) {
    locationQueries.add(derivedLocation);
    for (const relaxedLocation of buildBroaderLocationQueries(derivedLocation)) {
      locationQueries.add(relaxedLocation);
    }
  }

  if (locationQueries.size === 0) {
    return null;
  }

  const cuisineHint = params.cuisine
    ?? (params.originDetails?.cuisine?.find((item) => item && item.toLowerCase() !== "restaurant"));
  const candidateResults: RestaurantWithBookingLinks[] = [];

  const nearbySearchResults = await Promise.allSettled(
    [...locationQueries].map((location) =>
      searchScrapedRestaurants({ location, cuisine: cuisineHint, hasBooking: true })
    )
  );
  for (const r of nearbySearchResults) {
    if (r.status === "fulfilled") candidateResults.push(...r.value);
  }

  const candidates = dedupeRestaurants(candidateResults)
    .filter((restaurant) => restaurant.id !== params.originRestaurantId)
    .map((restaurant) => ({
      restaurant,
      distanceMeters: calculateDistanceMeters(params.originDetails?.location, restaurant.location),
    }))
    .sort((left, right) => {
      if (left.distanceMeters == null && right.distanceMeters == null) return 0;
      if (left.distanceMeters == null) return 1;
      if (right.distanceMeters == null) return -1;
      return left.distanceMeters - right.distanceMeters;
    })
    .slice(0, 3);

  const availabilityResults = await Promise.allSettled(
    candidates.map((candidate) =>
      getAvailabilitySnapshot({
        restaurantId: candidate.restaurant.id,
        tabelogUrl: candidate.restaurant.tabelogUrl,
        date: params.date,
        partySize: params.partySize,
      }).then((availability) => ({ candidate, availability }))
    )
  );

  for (const result of availabilityResults) {
    if (result.status === "rejected") continue;
    const { candidate, availability } = result.value;

    const suggestedTime = selectSuggestedTime(availability.availableSlots, normalizedRequestedTime);
    if (!suggestedTime) {
      continue;
    }

    const cuisineLabel = pickCuisineLabel(candidate.restaurant.cuisine, cuisineHint);
    const distanceText = candidate.distanceMeters != null
      ? ` ${candidate.distanceMeters}m away`
      : " nearby";

    const message = normalizedRequestedTime
      ? `That exact slot is not available, but ${candidate.restaurant.name}${distanceText} serves ${cuisineLabel} and has availability at ${suggestedTime}.`
      : `I couldn't find availability there, but ${candidate.restaurant.name}${distanceText} serves ${cuisineLabel} and has availability at ${suggestedTime}.`;

    return {
      restaurantId: candidate.restaurant.id,
      restaurantName: candidate.restaurant.name,
      cuisine: cuisineLabel,
      availableTime: suggestedTime,
      distanceMeters: candidate.distanceMeters,
      source: availability.source,
      message,
    };
  }

  return null;
}

async function handleSearchRestaurants(input: Record<string, unknown>) {
  const latitude = input.latitude as number | undefined;
  const longitude = input.longitude as number | undefined;

  const searchKey = JSON.stringify({
    location: input.location,
    cuisine: input.cuisine,
    priceLevel: input.price_level,
    openNow: input.open_now,
    lat: latitude != null ? Math.round(latitude * 100) / 100 : undefined,
    lng: longitude != null ? Math.round(longitude * 100) / 100 : undefined,
    limit: typeof input.limit === "number" ? input.limit : 5,
  });
  const cachedSearch = cacheGet<ReturnType<typeof buildSearchResponse>>(
    searchCache as Map<string, { ts: number; value: ReturnType<typeof buildSearchResponse> }>,
    searchKey,
    SEARCH_CACHE_TTL_MS
  );
  if (cachedSearch) return cachedSearch;

  // Train line mode: parallel search across key dining stations, merge + deduplicate
  const trainLineInput = input.train_line as string | undefined;
  if (trainLineInput) {
    const lineKey = Object.keys(TRAIN_LINE_STATIONS).find(k =>
      k === trainLineInput.toLowerCase() ||
      TRAIN_LINE_STATIONS[k].nameEn.toLowerCase() === trainLineInput.toLowerCase() ||
      TRAIN_LINE_STATIONS[k].nameJa === trainLineInput
    );
    const lineData = lineKey ? TRAIN_LINE_STATIONS[lineKey] : undefined;
    if (lineData) {
      const cuisine = input.cuisine as string | undefined;
      const limit = typeof input.limit === "number" && input.limit > 0 ? input.limit : 8;
      const stationResults = await Promise.allSettled(
        lineData.stations.map(station =>
          searchRestaurants({ location: `${station.name}, Tokyo`, cuisine, latitude: station.lat, longitude: station.lng, radius: 1000 })
        )
      );
      const seen = new Set<string>();
      const merged: Restaurant[] = [];
      for (const result of stationResults) {
        if (result.status === "fulfilled") {
          for (const r of result.value) {
            if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
          }
        }
      }
      const limitedResults = merged.slice(0, limit) as RestaurantWithBookingLinks[];
      const googleRatingByName = new Map<string, number>();
      for (const g of merged) { if (g.name && g.rating) googleRatingByName.set(g.name.toLowerCase(), g.rating); }
      const response = buildSearchResponse(limitedResults, "google", googleRatingByName, new Map<string, number>(), new Map<string, number>(), undefined, undefined, null);
      cacheSet(searchCache as Map<string, { ts: number; value: typeof response }>, searchKey, response);
      return response;
    }
  }

  const [scrapedResult, googleResult] = await Promise.allSettled([
    searchScrapedRestaurants({
      location: input.location as string,
      cuisine: input.cuisine as string | undefined,
      priceLevel: input.price_level as number | undefined,
    }),
    searchRestaurants({
      location: input.location as string,
      cuisine: input.cuisine as string | undefined,
      priceLevel: input.price_level as number | undefined,
      openNow: input.open_now as boolean | undefined,
      ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
    }),
  ]);
  let scrapedRestaurants = scrapedResult.status === 'fulfilled' ? scrapedResult.value : [];
  const googleRestaurants = googleResult.status === 'fulfilled' ? googleResult.value : [];

  // If the neighborhood name returned nothing, try its parent ward in the scraper DB.
  // e.g. "Hongo" → records are stored as area="Bunkyo", so retry with the mapped name.
  if (scrapedRestaurants.length === 0) {
    const inputLocation = input.location as string;
    const mappedArea = NEIGHBORHOOD_TO_AREA[inputLocation.toLowerCase().replace(/\s+/g, "_")];
    if (mappedArea) {
      const wardResults = await searchScrapedRestaurants({
        location: mappedArea,
        cuisine: input.cuisine as string | undefined,
        priceLevel: input.price_level as number | undefined,
      });
      if (wardResults.length > 0) scrapedRestaurants = wardResults;
    }
  }

  // Live Tabelog fallback — only useful for area-based discovery WITHOUT cuisine filter.
  // Tabelog's server-side rendering ignores ALL filter params (keyword, category codes, etc.)
  // and always returns the top-rated restaurants in the area regardless of cuisine.
  // When cuisine is specified, Google Places is the reliable source (uses keyword in query text).
  if (scrapedRestaurants.length < 3 && !input.cuisine && googleRestaurants.length < 5) {
    const liveResults = await searchTabelogLive({
      location: input.location as string,
      priceLevel: input.price_level as number | undefined,
    });
    if (liveResults.length > 0) scrapedRestaurants = liveResults;
  }

  // When cuisine is specified: prefer Google Places (reliable keyword search) over
  // Tabelog DB results (which may have wrong/empty cuisine tags from scraping).
  let results: typeof scrapedRestaurants;
  let source: string;
  if (input.cuisine) {
    // Use Google if it has results; fall back to DB only if Google returned nothing
    results = googleRestaurants.length > 0 ? googleRestaurants : scrapedRestaurants;
    source = googleRestaurants.length > 0 ? 'google' : 'tabelog';
  } else {
    results = scrapedRestaurants.length > 0 ? scrapedRestaurants : googleRestaurants;
    source = scrapedRestaurants.length > 0 ? 'tabelog' : 'google';
  }

  // Post-filter by cuisine on Tabelog/DB results (Google results are already cuisine-matched
  // via the query text so we skip filtering them to avoid over-restricting).
  const CUISINE_JA_MAP: Record<string, string> = {
    italian: "イタリアン", sushi: "寿司", ramen: "ラーメン", yakitori: "焼き鳥",
    tempura: "天ぷら", izakaya: "居酒屋", soba: "そば", udon: "うどん",
    tonkatsu: "とんかつ", yakiniku: "焼肉", kaiseki: "懐石", french: "フレンチ",
    chinese: "中華", korean: "韓国料理", thai: "タイ料理", seafood: "海鮮",
    steak: "ステーキ",
  };
  if (input.cuisine && source === 'tabelog' && results.length > 0) {
    const q = (input.cuisine as string).toLowerCase();
    const ja = CUISINE_JA_MAP[q];
    const filtered = results.filter((r) => {
      if (!r.cuisine?.length) return true;
      return r.cuisine.some((c) =>
        c.toLowerCase().includes(q) || (ja ? c.includes(ja) : false)
      );
    });
    if (filtered.length >= 2) results = filtered;
  }

  let fallbackMessage: string | undefined;
  let relaxedLocation: string | undefined;

  if (results.length === 0) {
    const fallback = await findRelaxedSearchFallback({
      location: input.location as string,
      cuisine: input.cuisine as string | undefined,
      priceLevel: input.price_level as number | undefined,
      openNow: input.open_now as boolean | undefined,
    });

    if (fallback.results.length > 0) {
      results = fallback.results;
      relaxedLocation = fallback.relaxedLocation;
      fallbackMessage = `I couldn't find an exact match in ${input.location as string}, but these nearby options in ${fallback.relaxedLocation} should be worth a look.`;
      source = fallback.results.some((restaurant) => Boolean((restaurant as { tabelogUrl?: string }).tabelogUrl))
        ? "tabelog"
        : "google";
    }
  }

  const limit = typeof input.limit === "number" && input.limit > 0 ? input.limit : 5;
  const limitedResults = results.slice(0, limit);

  // Build a name→rating map from Google results so tabelog cards can show both ratings
  const googleRatingByName = new Map<string, number>();
  for (const g of googleRestaurants) {
    if (g.name && g.rating) googleRatingByName.set(g.name.toLowerCase(), g.rating);
  }

  // Build a name→rating map from Tabelog/DB results so Google cards can show Tabelog scores.
  // Index normalized names — scraper may use different casing/punctuation than Google.
  const tabelogRatingByName = new Map<string, number>();
  for (const t of scrapedRestaurants) {
    if (t.name && t.rating) tabelogRatingByName.set(normName(t.name), t.rating);
    const tNameJa = (t as { nameJa?: string }).nameJa;
    if (tNameJa && t.rating) tabelogRatingByName.set(normName(tNameJa), t.rating);
  }

  // For Google-sourced results: build a proper tabelog enrichment map using name-similarity
  // + proximity matching (same approach as /api/restaurants route) — more reliable than exact name lookup.
  const tabelogEnrichmentById = new Map<string, number>();
  if (source === 'google') {
    for (const g of limitedResults) {
      if (tabelogEnrichmentById.has(g.id)) continue;
      const match = scrapedRestaurants.find((s) => {
        if (!s.rating) return false;
        const similar = namesSimilar(s.name, g.name) ||
          (s as { nameJa?: string }).nameJa && namesSimilar((s as { nameJa?: string }).nameJa!, g.name);
        if (!similar) return false;
        const dist = calculateDistanceMeters(g.location, s.location);
        return dist == null || dist < 250;
      });
      if (match?.rating) tabelogEnrichmentById.set(g.id, match.rating);
    }
  }

  // Inline top-result details — eliminates the mandatory 2nd get_restaurant_details tool call (~300ms saved)
  const topDetails = limitedResults[0]
    ? await Promise.race([
        loadRestaurantDetails(limitedResults[0].id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
      ]).catch(() => null)
    : null;

  const response = buildSearchResponse(limitedResults, source, googleRatingByName, tabelogRatingByName, tabelogEnrichmentById, fallbackMessage, relaxedLocation, topDetails);

  // Cache and speculative detail prefetch for remaining results
  cacheSet(searchCache as Map<string, { ts: number; value: typeof response }>, searchKey, response);
  for (const r of limitedResults.slice(1)) {
    loadRestaurantDetails(r.id).catch(() => {}); // fire-and-forget: populates detailsCache
  }

  return response;
}

function buildSearchResponse(
  limitedResults: RestaurantWithBookingLinks[],
  source: string,
  googleRatingByName: Map<string, number>,
  tabelogRatingByName: Map<string, number>,
  tabelogEnrichmentById: Map<string, number>,
  fallbackMessage: string | undefined,
  relaxedLocation: string | undefined,
  topDetails?: RestaurantDetailsWithBookingLinks | null,
) {
  return {
    count: limitedResults.length,
    ...(fallbackMessage ? { fallbackMessage, relaxedLocation } : {}),
    restaurants: limitedResults.map((r, index) => ({
      id: r.id,
      name: r.name,
      nameJa: (r as { nameJa?: string }).nameJa,
      address: r.address,
      rating: r.rating,
      tabelogRating: source === "tabelog"
        ? r.rating
        : (tabelogEnrichmentById.get(r.id)
          ?? tabelogRatingByName.get(normName(r.name ?? ""))
          ?? tabelogRatingByName.get(normName((r as { nameJa?: string }).nameJa ?? ""))
          ?? undefined),
      googleRating: source === "google"
        ? r.rating
        : (googleRatingByName.get(r.name?.toLowerCase() ?? "")
          ?? googleRatingByName.get((r as { nameJa?: string }).nameJa?.toLowerCase() ?? "")
          ?? undefined),
      priceLevel: r.priceLevel ? "$".repeat(r.priceLevel) : undefined,
      cuisine: r.cuisine,
      openNow: r.openNow,
      photoUrl: r.photoUrl || getCuisinePhotoFallback(r.cuisine),
      location: r.location,
      lat: r.location?.lat,
      lng: r.location?.lng,
      hasOnlineBooking: Boolean((r as RestaurantWithBookingLinks).hasOnlineBooking ?? (r as RestaurantWithBookingLinks).bookingUrl),
      ratingCount: (r as RestaurantWithBookingLinks).ratingCount,
      priceRange: (r as RestaurantWithBookingLinks).priceRange,
      tabelogUrl: (r as RestaurantWithBookingLinks).tabelogUrl,
      website: (r as { website?: string }).website,
      awards: lookupAwards(r.name),
      // Inline details for the top result only — Claude uses these instead of calling get_restaurant_details
      ...(index === 0 && topDetails ? {
        phone: topDetails.phoneNumber,
        openingHours: topDetails.openingHours,
        topReviews: topDetails.reviews?.slice(0, 2).map((rev) => ({
          rating: rev.rating,
          text: rev.text.substring(0, 150),
        })),
      } : {}),
    })),
  };
}

async function handleGetRestaurantDetails(input: Record<string, unknown>) {
  const restaurantId = input.restaurant_id as string;
  if (!restaurantId || typeof restaurantId !== "string" || restaurantId.length > 200 || !/^[a-zA-Z0-9_\-]+$/.test(restaurantId)) {
    return { error: "Invalid restaurant ID format" };
  }
  const scraped = await getScrapedRestaurantDetails(restaurantId);

  if (scraped) {
    return {
      id: scraped.id,
      name: scraped.name,
      address: scraped.address,
      phone: scraped.phoneNumber,
      website: scraped.website,
      rating: scraped.rating,
      priceLevel: scraped.priceLevel ? "$".repeat(scraped.priceLevel) : "Unknown",
      cuisine: scraped.cuisine,
      openingHours: scraped.openingHours,
      isOpenNow: null,
      topReviews: [],
      photos: scraped.photos ?? [],
      tabelogUrl: (scraped as { tabelogUrl?: string }).tabelogUrl,
      bookingUrl: (scraped as { bookingUrl?: string }).bookingUrl,
    };
  }

  const details = await getRestaurantDetails(restaurantId);

  return {
    id: details.id,
    name: details.name,
    address: details.address,
    phone: details.phoneNumber,
    website: details.website,
    rating: details.rating,
    priceLevel: details.priceLevel ? "$".repeat(details.priceLevel) : "Unknown",
    cuisine: details.cuisine,
    openingHours: details.openingHours,
    isOpenNow: details.openNow,
    photos: details.photos ?? [],
    topReviews: details.reviews?.slice(0, 3).map((r) => ({
      author: r.author,
      rating: r.rating,
      text: r.text.substring(0, 200) + (r.text.length > 200 ? "..." : ""),
    })),
  };
}

async function handleCheckAvailability(input: Record<string, unknown>): Promise<AvailabilityResult> {
  const date = input.date as string;
  const partySize = input.party_size as number;
  const restaurantId = input.restaurant_id as string | undefined;
  const requestedTime = normalizeTime(input.requested_time as string | undefined);
  const locationHint = input.location as string | undefined;
  const restaurantName = input.restaurant_name as string;
  const primaryDetails = await loadRestaurantDetails(restaurantId);

  const availability = await getAvailabilitySnapshot({
    restaurantId,
    tabelogUrl: primaryDetails?.tabelogUrl,
    date,
    partySize,
  });

  const exactTimeAvailable = isRequestedTimeAvailable(availability.availableSlots, requestedTime);

  const result: AvailabilityResult = {
    restaurantName,
    date,
    partySize,
    availableSlots: availability.availableSlots,
    source: availability.source,
    ...(requestedTime ? { requestedTime, exactTimeAvailable } : {}),
  };

  const shouldSuggestNearbyAlternative = requestedTime
    ? !exactTimeAvailable
    : availability.availableSlots.length === 0;

  if (shouldSuggestNearbyAlternative) {
    const alternativeSuggestion = await Promise.race([
      findNearbyAvailabilitySuggestion({
        originRestaurantId: restaurantId,
        requestedTime,
        date,
        partySize,
        locationHint,
        cuisine: input.cuisine as string | undefined,
        originDetails: primaryDetails,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);

    if (alternativeSuggestion) {
      result.alternativeSuggestion = alternativeSuggestion;
      result.fallbackMessage = alternativeSuggestion.message;
    }
  }

  return result;
}

async function handleMakeReservation(input: Record<string, unknown>, userId?: string) {
  const bookingData: BookingRequest = {
    restaurantId: input.restaurant_id as string,
    restaurantName: input.restaurant_name as string,
    partySize: input.party_size as number,
    dateTime: input.date_time as string,
    customerName: input.customer_name as string,
    customerPhone: input.customer_phone as string | undefined,
    customerEmail: input.customer_email as string | undefined,
    specialRequests: input.special_requests as string | undefined,
  };

  const dateObj = new Date(bookingData.dateTime);
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj); // YYYY-MM-DD in JST
  const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(dateObj); // HH:MM in JST

  // Try Tabelog browser automation first
  let tabelogConfirmation: string | undefined;
  let tabelogSuccess = false;
  try {
    const details = await getScrapedRestaurantDetails(bookingData.restaurantId);
    const tabelogUrl = (details as { tabelogUrl?: string } | null)?.tabelogUrl;

    if (tabelogUrl && bookingData.customerEmail && bookingData.customerPhone) {
      const result = await makeTabelogReservation({
        tabelogUrl,
        date: dateStr,
        time: timeStr,
        partySize: bookingData.partySize,
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        customerPhone: bookingData.customerPhone,
        specialRequests: bookingData.specialRequests,
      });
      tabelogSuccess = result.success;
      tabelogConfirmation = result.confirmationId;
      if (!result.success) {
        console.warn("[tools] Tabelog reservation attempt failed:", result.message);
      }
    }
  } catch (err) {
    console.warn("[tools] Tabelog reservation failed, recording locally:", err);
  }

  // Always record in local DB
  const booking = await prisma.booking.create({
    data: {
      restaurantId: bookingData.restaurantId,
      restaurantName: bookingData.restaurantName,
      partySize: bookingData.partySize,
      dateTime: dateObj,
      customerName: bookingData.customerName,
      customerPhone: bookingData.customerPhone,
      customerEmail: bookingData.customerEmail,
      specialRequests: bookingData.specialRequests,
      status: "confirmed",
      ...(userId ? { userId } : {}),
    },
  });

  // Fire-and-forget confirmation email
  if (bookingData.customerEmail) {
    sendBookingConfirmation({
      to: bookingData.customerEmail,
      customerName: bookingData.customerName,
      restaurantName: bookingData.restaurantName,
      date: dateObj.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", da

[... truncated ...]