# KOKWET Groceries

A full grocery e-commerce site (customer storefront + admin dashboard) built with
**TypeScript, React, Tailwind CSS, Express, and MongoDB** — modeled on Carrefour Kenya's
online store, styled in green, white, and a touch of orange.

```
kokwet-groceries/
├── backend/     Express + TypeScript + MongoDB API
└── frontend/    React + TypeScript + Tailwind storefront + admin dashboard
```

## What's inside

**Customer storefront**
- Home page with hero banner, category shortcuts, and featured products
- Category browsing with sorting, and a search page with live results
- Product detail pages with stock levels, discount badges, and related items
- Persistent cart (drawer + full page) that survives a page refresh
- Checkout with delivery-area selection, Cash on Delivery or M-Pesa, and a clear price
  breakdown (subtotal, delivery fee, total) before the order is placed
- Order confirmation and order tracking with a visual progress tracker
- Mobile-first design with a bottom navigation bar, and a desktop layout with a sticky header

**Admin dashboard** (`/admin`)
- Simple sidebar navigation with large icons and plain-language labels
- Dashboard with big, easy-to-read numbers (orders, revenue, pending deliveries)
- Product management: add, edit, delete, mark featured/hidden, track stock
- Category management: add, rename, delete
- Order management: see every order and move it forward (Confirm → Preparing →
  Out for delivery → Delivered) with one tap, or cancel it
- Confirmation prompts before any delete, so mistakes are hard to make by accident

## Getting started

You'll need [Node.js](https://nodejs.org) (v18+) and a MongoDB database — either
installed locally or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# open .env and set MONGO_URI (and JWT_SECRET to any long random string)
npm run seed     # creates sample categories, products, and an admin account
npm run dev      # starts the API on http://localhost:5000
```

Seed creates an admin login you can use immediately:
- **Email:** admin@kokwetgroceries.co.ke
- **Password:** admin1234

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL should already point to http://localhost:5000/api
npm run dev      # starts the storefront on http://localhost:5173
```

Visit `http://localhost:5173` for the storefront, and `http://localhost:5173/admin/login`
for the admin dashboard.

### Browser smoke checks

With MongoDB, the API, and the storefront running, run the Selenium checks from the
`frontend/` directory:

```bash
npm run test:selenium
```

The check uses headless Chrome, signs in with the seeded local admin account, verifies
dashboard and customer pages, uploads and removes a temporary product with a test image,
and deletes the temporary image file. Override `KOKWET_ADMIN_EMAIL` and
`KOKWET_ADMIN_PASSWORD` if your local admin credentials differ.

### Playwright frontend checks

The standalone `playwright-tests/` folder contains browser tests that mock the API and do not
modify live store data. See its README for setup and run instructions.

## Adding your logo

Drop your logo file into `frontend/public/` (e.g. `logo.png`), then open
`frontend/src/components/layout/Logo.tsx` and replace the emoji + text with:

```tsx
<img src="/logo.png" alt="KOKWET Groceries" className="h-8" />
```

## Production deployment runbook

This project is structured so the backend and frontend can be deployed independently:

1. Put the repository on GitHub.
2. Deploy the backend from the `backend/` directory on Render (or another Node.js host).
3. Deploy the frontend from the `frontend/` directory on Cloudflare Pages.
4. Connect the deployed frontend origin to the backend `CLIENT_URL` and set the frontend
   `VITE_API_URL` to the public backend API URL.

### 1. Backend on Render

- Repository root: the GitHub repo
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Production environment variables:
  - `NODE_ENV=production`
  - `PORT=10000` (Render will inject the port automatically, but keeping this value here helps local/host parity)
  - `MONGO_URI=<MongoDB Atlas SRV URI>`
  - `JWT_SECRET=<long random secret>`
  - `CLIENT_URL=https://<frontend-production-origin>`
  - `FREE_DELIVERY_THRESHOLD=3000`
  - `STANDARD_DELIVERY_FEE=150`

The backend API listens on the host port assigned by the platform and uses `CLIENT_URL` to
permit the storefront origin in CORS and social-auth redirects.

### 2. MongoDB Atlas

- Create a MongoDB Atlas cluster (for example, an M0 or shared cluster in Cape Town)
- Create a database user with a custom role scoped to the `kokwet-groceries` database only
- Copy the MongoDB SRV connection string into `MONGO_URI`
- Keep the app user separate from the admin account used for the project itself

This keeps database permissions narrow and avoids over-scoped roles like `readWriteAnyDatabase`.

### 3. Frontend on Cloudflare Pages

- Project root: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Production environment variable: `VITE_API_URL=https://<backend-host>/api`
- The frontend uses `frontend/public/_redirects` so that client-side routes work correctly on
  Cloudflare Pages
- Add the deployed storefront domain to the backend `CLIENT_URL` environment variable exactly as it appears in the browser

### 4. Typical production env values

```env
# backend/.env (production)
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://<user>:<password>@kokwet-groceries.<cluster>.mongodb.net/kokwet-groceries?retryWrites=true&w=majority
JWT_SECRET=<generate-a-long-random-secret>
CLIENT_URL=https://example-storefront.pages.dev
FREE_DELIVERY_THRESHOLD=3000
STANDARD_DELIVERY_FEE=150
```

```env
# frontend/.env.production or Cloudflare Pages variable
VITE_API_URL=https://example-api.onrender.com/api
```

### 5. Uploaded files in production

Product and admin uploads are stored under `backend/uploads/`. For a production deployment, keep
that directory on a persistent volume or move files to a durable storage platform before relying
on uploaded images in a live environment. Container filesystems can be replaced during deploys.

## Notes on payments and delivery

- **Cash on Delivery** works out of the box.
- **M-Pesa Daraja STK Push** is implemented. Configure the Daraja credentials and public
  callback URL as backend environment secrets; use sandbox credentials and a sandbox phone
  number to test before requesting live Daraja access.
- Delivery areas and the free-delivery threshold are simple lists/numbers you can edit in
  `frontend/src/pages/CheckoutPage.tsx` (`AREAS`) and `backend/.env`
  (`FREE_DELIVERY_THRESHOLD`, `STANDARD_DELIVERY_FEE`).

## Project conventions

- **No Redux/complex state libraries** — cart and auth use React's built-in Context API,
  persisted to `localStorage`, kept intentionally simple to read and extend.
- **File organisation** — one file per component/page/route, grouped by feature
  (`components/product`, `components/cart`, `pages/admin`, etc.), all in TypeScript.
- **Routing** — every route is declared in one place: `frontend/src/App.tsx` for the
  storefront + admin, and `backend/src/app.ts` for the API.
