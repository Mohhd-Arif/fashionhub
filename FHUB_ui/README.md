# Fashion Hub

A light, responsive React storefront for a neighbourhood garment shop, built with Vite and Lucide icons.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build` and inspect it with `npm run preview`.

Start the sibling `FHUB_be` server on port 8000 first. Vite proxies `/api` to it. Use **http://localhost:5173/login** for both administrators and customers: the backend role sends admins to `/admin` and customers to `/`.

The requested administrator account is configured in MongoDB. To create additional admin accounts, run `npm run admin:create` from `FHUB_be`. Public registration only creates customers.

Run the browser checks with `npm test` (uses installed Google Chrome, backend dependencies, and the backend MongoDB configuration). API and admin browser tests use isolated randomly named test databases and remove their own documents afterward.

## Included

- Mobile-first landing page with swipeable kids/gents/ladies carousel, pause controls and matching descriptions
- Live MongoDB article search, category filters, sorting, pagination and saved favourites
- Product galleries, custom sizes, quantity checks, INR pricing and percentage discounts
- Browser-local shopping bag, refreshed against current stock/prices when opened
- Shared login with role-based routing, customer registration and logout
- Admin article CRUD, stock summary, image upload/removal, and responsive mobile cards
- Admin Storefront tab for carousel images, copy, offers, featured articles, story/contact details and publishing
- Keyboard-accessible dialogs and reduced-motion support

Uploaded photographs or AI-generated images are stored in MongoDB GridFS. HTTPS image URLs are also supported. Default Unsplash photographs are bundled in `public/images` and can be replaced through the Storefront editor. Google Fonts have local font fallbacks. The shop starts with an empty article list until an admin adds real inventory; no demo products are mixed into the live catalogue.

The bag supports store enquiries; it does not take payment or reserve stock. Configure your contact information in the Storefront tab. No online order checkout is implemented.

Storefront UI: `src/storefront`. Admin/login UI: `src/admin`. API contract and schema: [backend README](../FHUB_be/README.md). For deployment, host the app and `/api` on the same HTTPS origin and configure the backend's `APP_ORIGINS` and `NODE_ENV=production`.
