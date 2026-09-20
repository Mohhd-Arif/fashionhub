# Fashion Hub API

Express + MongoDB accounts, inventory and editable storefront. Requires Node.js 20+.

## Run

```sh
npm install
npm run db:check
npm run dev
```

Configure `.env` using `.env.example` if it does not already exist. The database is selected by the existing URI; the current local configuration is preserved. Optional `MONGODB_DB` overrides the database for isolated tests. Keep credentials server-side, never in a `VITE_` variable. `npm start` runs without nodemon. Do not run both start commands on the same port (default 8000).

The server accepts requests only after MongoDB connects and indexes are ready. `/health` returns 200 when the database responds, otherwise 503. `/test` retains the original test response. Connections close on SIGINT/SIGTERM.

## Account flow

Everyone uses **http://localhost:5173/login**. The backend returns the stored role; admins are sent to `/admin` (article list), customers to `/`. The requested `admin@gmail.com` account has been configured in the local connected database with the password supplied by the owner. That password is hashed, not stored in source or documentation.

Additional administrators can be created from a trusted backend terminal:

```sh
npm run admin:create
```

Enter an email and an 8+ character password (hidden input). The command refuses existing emails instead of silently promoting customers. Automation can supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` through process environment variables. Public sign-up only creates the `user` role.

## Data model

| Collection | Data |
| --- | --- |
| `users` | `_id`, unique lowercase email, salted scrypt `passwordHash`, `usertype` (`admin`/`user`), timestamp |
| `articles` | `_id`, unique normalized `nameKey`, display name, quantity, size, Decimal128 price/discount, gender, category, images, version, timestamps, creator |
| `sessions` | Hashed random session token, user ID, 8-hour expiry with TTL index |
| `storefront` | Single `main` document with store copy, kids/gents/ladies slides, image references, offers, featured article IDs, story/contact settings, version |
| `articleImages.files` / `.chunks` | GridFS image bytes and metadata |
| `imageCleanup` | Retry queue for failed image deletions, processed every minute |

`quantity` and `discount` are the canonical spellings. Each article has one size and stock quantity; different size variants currently require separately named articles. Standard aliases normalize to XS/S/M/L/XL/XXL/XXXL; custom sizes up to 40 characters are allowed. Category is `kids`, `gents` or `ladies`; gender remains `male`/`female`. Missing category defaults from gender for compatibility.

Prices are exact Decimal128 values and returned as strings (INR, 0–9,999,999.99, up to 2 decimal places). Discounts are percentages, 0–100 with up to 2 decimals. Quantity is an integer from 0 to 1,000,000. Names are unique regardless of case and extra spaces.

## API contract

Base: `/api`. All errors return `{ "error": "Readable message" }`. Every POST/PATCH/DELETE requires `X-Requested-With: FashionHub`. Retain the session cookie after login. Use `Content-Type: application/json` for JSON; let FormData set its own multipart boundary. The frontend helper handles this automatically.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | `{email,password}` → 201 `{user}`; customer role only |
| POST | `/auth/login` | `{email,password}` → 200 `{user:{id,email,usertype}}` + session cookie |
| GET | `/auth/me` | Current authenticated user |
| POST | `/auth/logout` | Revoke session + clear cookie; 204 |
| GET | `/articles` | Public live inventory, search/filter/pagination |
| GET | `/articles/:id` | Public article details |
| GET | `/storefront` | Public `{storefront,featured}` for the landing page |
| GET | `/images/:id` | Public WebP bytes for an image attached to an article or storefront |
| GET | `/admin/articles` | Admin article list |
| GET | `/admin/articles/summary` | Admin stock summary |
| GET | `/admin/articles/:id` | Admin article details |
| POST | `/admin/articles` | Admin create (JSON or multipart), 201 `{article}` |
| PATCH | `/admin/articles/:id` | Admin save full editable fields plus `version`, 200 `{article}` |
| DELETE | `/admin/articles/:id` | Admin delete with JSON `{version}`, 204 |
| GET | `/admin/storefront` | Admin editable storefront settings |
| PATCH | `/admin/storefront` | Admin publish full settings plus `version` (JSON or multipart) |

Admin routes enforce the role server-side, including for image uploads. Unauthenticated requests receive 401; normal users receive 403. Invalid data returns 400, missing resources 404, duplicate names/emails or concurrent edits 409.

### Article example

```json
{
  "name": "Everyday linen shirt - Sage - M",
  "quantity": 12,
  "size": "medium",
  "price": "1299.95",
  "discount": "10.00",
  "gender": "female",
  "category": "ladies",
  "images": ["https://your-image-host.example/shirt.webp"]
}
```

An empty image array is allowed. IDs are generated by MongoDB. Unknown fields cannot set IDs, ownership, roles or update operators.

List example: `/admin/articles?search=linen&category=ladies&stock=low&page=1&limit=12`. Returns `{articles,total,page,pages}`. Optional gender filtering is also supported. `stock`: `in`, `low` (1–5) or `out`. Admin page sizes: 1–100; public catalogue: 12. Public sorting supports `sort=newest|low|high` (base price). The public list supports `category`, `search` and `page`.

### Images inside MongoDB

Create/update an article using multipart field `article` containing the article JSON, plus up to six files all named `images`. The article JSON's `images` array holds retained image references and external HTTPS links. Existing images can only be retained by their owning article. Omitting `images` on update preserves existing images; `[]` removes them.

```js
const data = new FormData();
data.append('article', JSON.stringify(article));
data.append('images', selectedFile);
await fetch('/api/admin/articles', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'X-Requested-With': 'FashionHub' }, body: data
});
```

Returned references are `{type:"gridfs",fileId,url:"/api/images/..."}` or `{type:"url",url:"https://..."}`. File bytes live in MongoDB rather than base64 strings in article documents. External URLs are stored without server-side downloading, so a future image-hosting migration uses the same field.

Limits: 6 article images, 5 MB per input file, 25 megapixels. JPEG/PNG/WebP are decoded, orientation-corrected, resized within 1600×1600, stripped of metadata and encoded as WebP. SVGs and invalid images are rejected. Deletion/replacement cleans up stored bytes, with a retry queue for temporary cleanup failures.

### Editable storefront

GET the admin settings, edit and PATCH back the settings with the returned `version`. For uploads use multipart text field `storefront` (JSON) and optional file fields `kids`, `gents`, `ladies`, `story` (one each, same file validation as articles).

Editable content includes store name, announcement, collection/catalogue introductions, the three slides' labels/headings/descriptions/badges/offer messages/buttons/images/featured article, story visibility and text/image, contact information and footer tagline. Slide IDs remain fixed so collection links stay consistent. Featured articles must exist in the matching collection. Deleting a featured article clears its slide reference.

All saves require the current integer version. A stale version returns 409 instead of overwriting another admin's work. Replaced files are removed after a successful update. Initial unsaved settings use the bundled default photos; admins can replace them with their own photographs or AI-generated images.

## Deployment and tests

The browser uses HttpOnly SameSite=Strict session cookies; production cookies also require HTTPS (`NODE_ENV=production`). Configure `APP_ORIGINS` to your exact frontend origin. No permissive cross-origin access is enabled. Serve the frontend and `/api` under one HTTPS origin using a reverse proxy. Vite proxies `/api` to port 8000 in development. For multiple backend instances, replace the default in-memory login limiter with a shared store and configure trusted proxy handling for your actual infrastructure.

`npm test` uses an isolated random `fhub_test_*` database on the configured MongoDB cluster. It removes only that run's documents afterward; empty test collections/indexes can remain because database-drop privileges are not required. Tests cover auth/roles/CSRF, validation, uniqueness, decimal storage, image streaming/rollback/cleanup, concurrency and storefront publishing. Frontend browser tests use their own isolated database too.

The storefront is connected to real inventory. Shopping bags are browser-local enquiries, not stock reservations. Online payment, order fulfilment and password recovery are not implemented.

References: [MongoDB GridFS](https://www.mongodb.com/docs/manual/core/gridfs/), [Node crypto](https://nodejs.org/api/crypto.html).
