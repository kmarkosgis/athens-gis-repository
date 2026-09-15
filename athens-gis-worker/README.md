# Athens GIS Worker

Cloudflare Worker backing the AI chat on [athensgis.gr](https://athensgis.gr). One endpoint:

```
POST /chat
Body: { "message": string, "manifestContext": array, "history"?: array, "activeLayers"?: array }
Response: { "reply": string, "actions": [{ "type", "datasetId", "field", "aggregation", "chartType" }, ...] }
```

`actions` is an array so one message can trigger more than one dataset (e.g. "show me hospitals
and pharmacies" comes back with two `load_dataset` actions). It's `[]` when there's nothing to
load, chart, or close. `type` is one of `"load_dataset"`, `"build_chart"`, or `"close_dataset"`.

Each dataset in `manifestContext` should also carry `attributeValues` (an object mapping some of
its `fields` to their real distinct values, e.g. `{"shop": ["bakery", "butcher", ...]}`) so the
model can match a query like "bakeries" to a dataset that has no "bakery" in its name/description
at all.

`activeLayers` is an array of dataset ids currently open on the map. The model can only emit a
`close_dataset` action for an id present in `activeLayers` (server-side enforced, not just prompt
instruction) - so "close all layers" resolves to one `close_dataset` action per currently-open id.

CORS is locked to `https://athensgis.gr` and `https://www.athensgis.gr`. Requests are rate
limited to 20/minute per IP via Cloudflare's native Rate Limiting binding.

## Setup

```
cd athens-gis-worker
npm install
```

You said you're already logged in via `wrangler login`, so no extra auth setup is needed.

## Run locally

```
npm run dev
```

Wrangler will print a local URL (typically `http://localhost:8787`). Leave it running while you test.

## Test with curl

While `wrangler dev` is running, in another terminal:

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://athensgis.gr" \
  -d '{
    "message": "show me the bus routes",
    "manifestContext": [
      {
        "id": "oasa-bus-routes",
        "name": "OASA Bus Routes",
        "description": "Bus routes in Athens operated by OASA.",
        "category": "Transportation Systems",
        "subcategory": "Road Transport",
        "type": "vector",
        "fields": ["line_id", "descr", "descr_eng", "distance_meters", "fid"],
        "attributeValues": {},
        "featureCount": 706,
        "tags": ["oasa", "bus", "routes", "transportation"]
      },
      {
        "id": "food-shops",
        "name": "Food Shops",
        "description": "Food shops locations in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Commerce",
        "type": "vector",
        "fields": ["shop", "name"],
        "attributeValues": { "shop": ["bakery", "butcher", "cheese", "deli", "greengrocer", "grocery", "pastry", "seafood"] },
        "featureCount": 512,
        "tags": ["food", "shops", "commerce", "poi"]
      }
    ],
    "history": []
  }'
```

Expected shape back:

```json
{
  "reply": "Here are the OASA bus routes.",
  "actions": [
    { "type": "load_dataset", "datasetId": "oasa-bus-routes", "field": null, "aggregation": null, "chartType": null }
  ]
}
```

Try a query that only matches via an attribute value, not the dataset name:

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://athensgis.gr" \
  -d '{
    "message": "show me bakeries",
    "manifestContext": [
      {
        "id": "food-shops",
        "name": "Food Shops",
        "description": "Food shops locations in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Commerce",
        "type": "vector",
        "fields": ["shop", "name"],
        "attributeValues": { "shop": ["bakery", "butcher", "cheese", "deli", "greengrocer", "grocery", "pastry", "seafood"] },
        "featureCount": 512,
        "tags": ["food", "shops", "commerce", "poi"]
      }
    ]
  }'
```

Should still return a `load_dataset` action for `food-shops`, even though "bakery" never appears
in its name or description — only in `attributeValues.shop`.

Try a multi-dataset request in one prompt:

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://athensgis.gr" \
  -d '{
    "message": "show me hospitals and food shops",
    "manifestContext": [
      {
        "id": "hospitals",
        "name": "Hospitals",
        "description": "Hospitals in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Healthcare",
        "type": "vector",
        "fields": ["name"],
        "attributeValues": {},
        "featureCount": 45,
        "tags": ["hospitals", "healthcare", "poi"]
      },
      {
        "id": "food-shops",
        "name": "Food Shops",
        "description": "Food shops locations in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Commerce",
        "type": "vector",
        "fields": ["shop", "name"],
        "attributeValues": { "shop": ["bakery", "butcher", "cheese", "deli", "greengrocer", "grocery", "pastry", "seafood"] },
        "featureCount": 512,
        "tags": ["food", "shops", "commerce", "poi"]
      }
    ]
  }'
```

Expect two entries in `actions` - one per dataset.

Try closing layers that are currently open (note `activeLayers`):

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://athensgis.gr" \
  -d '{
    "message": "close all layers",
    "manifestContext": [
      {
        "id": "hospitals",
        "name": "Hospitals",
        "description": "Hospitals in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Healthcare",
        "type": "vector",
        "fields": ["name"],
        "attributeValues": {},
        "featureCount": 45,
        "tags": ["hospitals", "healthcare", "poi"]
      },
      {
        "id": "food-shops",
        "name": "Food Shops",
        "description": "Food shops locations in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Commerce",
        "type": "vector",
        "fields": ["shop", "name"],
        "attributeValues": { "shop": ["bakery", "butcher", "cheese", "deli", "greengrocer", "grocery", "pastry", "seafood"] },
        "featureCount": 512,
        "tags": ["food", "shops", "commerce", "poi"]
      }
    ],
    "activeLayers": ["hospitals", "food-shops"]
  }'
```

Expect two `close_dataset` actions, one for each id in `activeLayers`. If you omit
`activeLayers` (or leave it empty) and ask to close something, expect `actions: []` and a reply
saying nothing is currently open — the Worker will never emit `close_dataset` for an id that
isn't in `activeLayers`, even if the model tries to.

Try a chart request too:

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://athensgis.gr" \
  -d '{
    "message": "chart food shops by shop type",
    "manifestContext": [
      {
        "id": "food-shops",
        "name": "Food Shops",
        "description": "Food shops locations in the region of Attica.",
        "category": "Points of Interest",
        "subcategory": "Commerce",
        "type": "vector",
        "fields": ["shop", "name"],
        "attributeValues": { "shop": ["bakery", "butcher", "cheese", "deli", "greengrocer", "grocery", "pastry", "seafood"] },
        "featureCount": 512,
        "tags": ["food", "shops", "commerce", "poi"]
      }
    ]
  }'
```

The `-H "Origin: ..."` header matters — omit it (or send a disallowed origin) and you should get
a `403`.

## Deploy

Only run this once you've confirmed local behavior is correct:

```
npm run deploy
```

Wrangler will print the deployed URL, something like:

```
https://athens-gis-worker.<your-subdomain>.workers.dev
```

That subdomain is your Cloudflare Workers account's default subdomain (visible in the Cloudflare
dashboard under Workers & Pages → your account → Workers subdomain, or in the deploy output
itself). Copy the full `*.workers.dev` URL into `CHAT_WORKER_URL` in `JS/config.js` on the
static site repo. You mentioned you'll add a custom route/domain yourself later — no changes
needed here for that, just point DNS/routes at this Worker in the Cloudflare dashboard whenever
you're ready.
