# Taste Trail

Taste Trail is a weekend culture agent built for the Qloo Agentic Hackathon. Select three films, musicians, or books found by Qloo Search, choose a city and mood, and get up to three cultural suggestions from Qloo Insights. Rejecting a suggestion makes a fresh Insights request for another result in the same category. Previously shown entities are excluded.

No recommendations are bundled with the app. Without a valid Qloo hackathon API key, search and planning fail visibly. If Qloo has no place results for the selected city, the app offers only supported film, music, and book results. It never claims venue hours, events, or availability.

## How it works

1. Each preference is resolved to a Qloo entity via `GET /search`.
2. The server queries `GET /v2/insights` for places, films, musicians, and books using all three entity IDs as taste signals. Place results include a city filter.
3. The mood changes category order, while Qloo provides every recommendation. Each result lists the three input signals; this is query provenance, not a claim that Qloo provided a per-preference causal explanation.
4. Rejecting a card calls Insights again and excludes all already shown IDs. If no unseen result exists, the app says so.

The browser only calls same-origin `/api/search` and `/api/plan`. `QLOO_API_KEY` is read by server-side code and is never sent to the browser.

## Run locally

Requires Node.js 22 or newer and a [Qloo hackathon key](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key).

```sh
npm install
cp .env.example .env.local
# Set QLOO_API_KEY in .env.local
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for Qloo request, fallback, and replacement tests; run `npm run build` for TypeScript and production build checks. The tests use controlled fixtures and do **not** prove the live Qloo API works in your region.

## Deploy

Import the public repository into Vercel as a Vite project. Set `QLOO_API_KEY` as a server-side project environment variable and deploy. Do not prefix it with `VITE_`. After deployment, search three real entities, create a trail, replace one suggestion, and repeat with Shanghai and Hangzhou. Check the browser network panel to verify the key is absent from responses and bundled JavaScript.

## Current limitations

- Qloo availability and regional place coverage must be verified with a real key. The app does not replace missing results with invented data.
- A mood prioritizes category order; it does not alter Qloo's ranking within a category.
- Qloo results may not contain images. In that case the UI shows a category icon.
- Place recommendations are discovery ideas, not a verified itinerary.

## Rights and credits

Application source is MIT-licensed. UI copy, CSS layout, and code were created for this project. The interface uses [Lucide](https://lucide.dev/license) icons (ISC license) and [Google Fonts](https://fonts.google.com/) families DM Sans and Instrument Serif (open font licenses). Qloo entity names, data, and any result images are returned live by Qloo and remain subject to Qloo and original rightsholders' terms; they are not included in this repository. No existing private project code, stories, photos, or video were reused.

The project is independent and is not endorsed by Qloo.
