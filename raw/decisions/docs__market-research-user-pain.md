<!-- Ingested from: docs/market-research-user-pain.md -->
<!-- Mtime: 2026-04-14T14:42:14.675Z -->

# Market Research: User Pain Points — Google Maps, Tabelog, Yelp
> Research date: 2026-04-14

---

## Google Maps — What Users Hate

**Core failure: it's a list, not an answer.**

### Filtering & Discovery
- Algorithm surfaces "most reviewed" not "most relevant" — buries hidden gems
- Terrible filtering in Japan specifically: users report zooming into a Tokyo neighborhood, clicking the restaurant filter, and being teleported to a random city
- No intent understanding — can't parse "cozy date spot under ¥8000 near Shibuya"
- Permanently closed restaurants still appear in results
- Wrong hours, outdated info — users arrive and the place doesn't exist
- One developer built his own restaurant finder from scratch because Google Maps kept failing him

### Fake Review Crisis
- Google blocked 240M+ fake reviews in 2024, up 40% from 2023 — the problem is accelerating, not shrinking
- Extortion rings: place 50 fake 1-stars, then demand payment to remove them (documented in Chicago, Philadelphia, 2025)
- AI-generated 5-star floods clogging listings — makes the review layer actively untrustworthy
- Users on Hacker News: *"The best way to find local restaurants has become walking around the neighborhood or word of mouth"*

### No Booking Flow
- Discovery and booking are entirely separate — Google Maps shows a pin, you're on your own to call or find a reservation link
- Google Reserve exists in Japan but coverage is extremely thin

**What they wanted:** Natural language that understands occasion + context + budget. Trustworthy reviews. One-tap booking without leaving the app.

---

## Tabelog — What Users Hate

**Core failure: opaque algorithm, trust crisis, walls out foreigners.**

### Algorithm & Score Manipulation
- **Tokyo District Court ruling**: found Kakaku.com violated antimonopoly law by algorithmically lowering chain restaurant scores — actual legal judgment, not just a complaint
- **3.0 reset problem**: restaurants report scores suddenly resetting to 3.0; Tabelog allegedly contacts them saying "use our paid reservation service or be downranked"
- Paid members' reviews weighted higher — two-tier review system
- Algorithm is a black box; even in the lawsuit, the methodology was only disclosed under court order
- Score gaming documented: businesses and power users manipulate scores; Tabelog's periodic algorithm changes are opaque

### Foreign Visitor Walls
- **¥440 fee per booking** to use Tabelog in English — Japanese users pay nothing
- No search bar in the English version — can't search by restaurant name
- English multilingual app only launched November 2025 (extremely recent)
- Most restaurants listed on Tabelog have **no online reservation** — phone required, in Japanese
- For foreigners: find the restaurant on Tabelog, then have to call in Japanese or give up

### Real-Time Availability Gap
- Tabelog is a review database, not a booking platform
- No slot data, no "is there a table tonight?" — it shows historical ratings only
- To actually book, users must go to a separate platform (Hotpepper, direct call, etc.)

**What they wanted:** Transparent, ungameable scores. English access without a surcharge. Ability to complete the booking from the same screen.

---

## Yelp — What Users Hate

**Core failure: business model poisons the product.**

### Trust Destroyed
- Research estimate: 16%+ of Yelp reviews are fake
- Businesses report genuine 5-star reviews mysteriously disappearing
- Paid promotion means sponsored restaurants surface first regardless of quality
- Users: *"Yelp became useless years ago. Walking around is better."*

### Predatory Business Model
- Businesses report being charged after cancellation — charges totaling $1,000+ with no recourse
- "Not a single new client, not a single paying customer, nothing but empty promises and predatory billing"
- Some businesses report Yelp removes real reviews and only keeps negative ones unless they advertise

*Less directly relevant for Japan, but the pattern is instructive: when platform revenue model conflicts with review integrity, users abandon the platform.*

---

## Japan-Specific Pain — The Hardest Problems

### The No-Show Crisis
- **¥200 billion/year** in F&B industry losses from reservation no-shows
- Foreign tourists drive much of this — book online without understanding Japanese cancellation culture
- For a 6-seat kappo, one no-show on a Friday ruins the night's revenue
- Restaurants responding with "no foreigners" policies, credit card mandatory booking, cancellation fees
- This is a systemic industry crisis, not a niche complaint

### The 90% Phone-Only Problem
- byFood's research: **90%+ of restaurants in Japan take only phone reservations**
- Foreigners literally cannot access most of Tokyo's restaurant inventory
- English speakers have to ask Japanese friends to call restaurants for them
- This is a structural market failure with no current technical solution at scale

### Foreign Tourist Surge + Zero Good Solutions
- Japan tourism hit records in 2024-2025, still growing
- Tourists want to eat at real Tokyo restaurants, not hotel restaurants
- Available English-friendly services:
  - **byFood**: 13,500 hand-curated restaurants, English booking — but manual, slow, limited scale
  - **Pocket Concierge**: high-end/omakase only — not useful for everyday dining
  - **Tableall**: charges credit cards without disclosing restaurant price upfront — trust complaints
  - **Tabelog English**: ¥440 fee, limited inventory, just launched multilingual app Nov 2025
- The gap: casual and mid-range phone-only Tokyo restaurants are completely inaccessible to non-Japanese speakers

### The Izakaya Bankruptcy Crisis
- Izakaya bankruptcies at a **15-year high** — 203 in Jan-Nov 2024, a new record
- Japan-wide business failures at a 12-year high in fiscal 2025
- Causes: weak yen → rising food import costs, labor shortages, demographic crisis
- **These restaurants need new demand channels desperately** — they are not resistant to new technology, they are in survival mode

---

## Emerging Competitor: DoorDash Zesty (December 2025)

**The most strategically significant finding.**

DoorDash launched **Zesty** in December 2025 — AI-powered natural language restaurant discovery app. Currently in SF Bay Area and New York.

- Users type: *"cozy pasta spot on the Lower East Side with outdoor seating under $100"*
- AI aggregates Google Maps, TikTok, Reddit, Eater, DoorDash order history
- Conversational follow-ups: "what do most people order?" "vegetarian options?"
- DoorDash built it because their own years of order data + taste signals still couldn't solve discovery with traditional filters

**Why this validates Yoyaku entirely:**
If a company with DoorDash's resources, data, and distribution built this from scratch in 2025, the problem is definitively real and unsolved.

**Why Zesty is not the answer for Yoyaku's market:**
- US-only — no Japan, no Asia roadmap
- Aggregates other people's data, doesn't own supply
- Cannot make phone reservations — ignores the 90% phone-only restaurant segment
- No Japanese language support, no cultural context for Japan dining
- Discovery only — doesn't complete the booking

---

## Synthesized: What Users Actually Want

Across all platforms and complaint threads, the same 8 desires appear consistently:

| Desire | Why they're not getting it today |
|---|---|
| **Natural language intent** — "quiet date, ¥8000, near Shibuya" | Every app uses category tags + star ratings, no intent parsing |
| **Trustworthy reviews** | Fake spam, paid manipulation, opaque algorithms on every platform |
| **Current, accurate info** | Hours, menus, closure status constantly outdated |
| **Real-time availability** — "is there a table tonight?" | Nobody answers this question for Tokyo's long-tail restaurants |
| **Booking completion in one flow** | Discovery and booking are always on separate platforms |
| **No language barrier in Japan** | Phone-only restaurants wall out foreigners completely |
| **No-show accountability** | Restaurants losing money, withdrawing from online booking |
| **Surface hidden/small restaurants** | Algorithms only show the already-famous; the 6-seat gem is invisible |

---

## Strategic Implications for Yoyaku

### 1. Autocall is the core product, not a feature
90% of Tokyo restaurants are phone-only. Autocall is the only technology that can access that inventory at scale. Every competitor manually contacts restaurants one by one. Yoyaku can call on demand. This is a 5x+ addressable market advantage if the call pipeline works reliably.

### 2. No-show reduction is the B2B sales pitch
Restaurants are losing ¥200B/year to no-shows. Izakayas are bankrupt. Any restaurant that adopts Yoyaku's booking flow and sees no-shows drop (via reminders + confirmation loops + optional deposits) will not leave. This is the supply-side lock-in mechanism.

### 3. Foreign tourist market is enormous and completely underserved
Tabelog charges foreigners ¥440/booking and just got an English app in November 2025. byFood is manual and limited. The tourist who wants a real izakaya experience has zero good options. Japan tourism is at record highs and growing. This is the fastest acquirable user segment.

### 4. The trust gap is an opportunity
Every incumbent has a trust problem: Google (fake reviews), Tabelog (score manipulation lawsuit, paid bias), Yelp (extortion model). A platform built around transparent, outcome-verified recommendations — where the AI can say "we successfully booked 47 people here last month, 0 no-shows" — has a trust advantage none of them can easily replicate.

### 5. DoorDash will come to Japan eventually
Zesty launched US-only December 2025. It will expand. The window to establish the Tokyo restaurant relationship network and preference graph is probably 18-24 months before a well-funded competitor attempts Japan. Move fast on restaurant partnerships.

---

## Sources
- [Google Maps Is Infested with Spambot Reviews - D Magazine](https://www.dmagazine.com/food-drink/2023/08/google-maps-is-infested-with-spambot-restaurant-reviews/)
- [Google's New Merchant Extortion Tool - Restaurant Technology News](https://restauranttechnologynews.com/2025/12/what-googles-new-merchant-extortion-tool-means-for-restaurant-operators/)
- [Google Maps terrible for hiding results - Hacker News](https://news.ycombinator.com/item?id=36329962)
- [Ask HN: Anyone else finding Google Maps terrible?](https://news.ycombinator.com/item?id=37563069)
- [On Japan's top foodie site, imperfection is gold - Japan Times](https://www.japantimes.co.jp/life/2025/03/09/food-drink/tabelog-ratings-cultural-influences/)
- [Tabelog ordered to pay damages - Japan Today](https://japantoday.com/category/national/operator-of-major-japan-restaurant-review-site-ordered-to-pay-damages)
- [Tabelog 3.0 reset — restaurant owner perspective](https://usaboku-coffee.com/en/archives/6833)
- [Tabelog launches multilingual app for international visitors](https://www.businesswire.com/news/home/20251221963753/en/Tabelog-Japans-Largest-1-Restaurant-Search-and-Reservation-Service-Launches-Multilingual-App-for-International-Visitors)
- [No-shows wreaking havoc on restaurant business - Japan Today](https://japantoday.com/category/features/kuchikomi/no-shows-wreaking-havoc-on-restaurant-business)
- [5 Reasons You're Turned Away From Restaurants in Japan - byFood](https://www.byfood.com/blog/turned-away-restaurants-japan-p-576)
- [Complete Guide to Restaurant Reservations in Japan](https://www.japantravelpros.com/blog/complete-guide-restaurant-reservations-japan)
- [Izakaya bankruptcies at record high - Japan Today](https://japantoday.com/category/business/tough-times-for-japanese-pubs-as-izakaya-bankruptcies-come-at-highest-rate-in-more-than-a-decade)
- [Japan business failures hit 12-year high - Japan Times](https://www.japantimes.co.jp/business/2026/04/08/companies/business-failures-fiscal-2025/)
- [DoorDash rolls out Zesty - TechCrunch](https://techcrunch.com/2025/12/16/doordash-rolls-out-zesty-an-ai-social-app-for-discovering-new-restaurants/)
- [DoorDash Zesty AI app - Restaurant Dive](https://www.restaurantdive.com/news/doordash-new-york-san-francisco-market-test-zesty-discovery-app/808118/)
- [Reddit users fed up with restaurant discovery - Sirved](https://www.sirved.com/blog/reddit-users-fed-up-with-restaurant-discovery/)
- [5 English-Friendly Reservation Services in Japan - GoConnect](https://goconnect.jp/2024/11/12/5-english-friendly-reservation-services-in-japan/)
- [Best Ways to Make a Restaurant Reservation in Japan - Tokyo Cheapo](https://tokyocheapo.com/food-and-drink/restaurant-reservation-japan/)
- [TABLEALL - Japan Restaurant Reservation Service](https://www.tableall.com/)
- [Pocket Concierge - Reserve top restaurants in Japan](https://www.pocket-concierge.jp/en)
