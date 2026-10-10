# KOKWET Groceries production hosting

This document is the production runbook for the project. The app is intentionally split into a
frontend storefront and a backend API so that each can be deployed and configured independently.

## 1. Frontend deployment

- Deploy the `frontend` directory to Cloudflare Pages.
- Set the Cloudflare Pages root directory to `frontend`.
- Build command: `npm run build`
- Output directory: `dist`
- Production environment variable: `VITE_API_URL=https://<backend-host>/api`
- The included `frontend/public/_redirects` file ensures client-side routes keep working.
- Add the exact storefront origin to the backend `CLIENT_URL` environment variable.

Example:

```env
VITE_API_URL=https://kokwet-groceries-api.onrender.com/api
VITE_MPESA_RECEIVING_NUMBER=0793048318
```

## 2. Backend deployment

- Deploy the `backend` directory to Render, Railway, Fly.io, or a Node.js host.
- Use the included `backend/render.yaml` as the Render-ready config.
- The Render blueprint uses the free plan: expect cold starts after inactivity.
- For Docker, build with `docker build -t kokwet-groceries-api ./backend`; the included
  multi-stage `backend/Dockerfile` compiles the TypeScript API.
- Set environment variables as production secrets:
  - `NODE_ENV=production`
  - `PORT=10000`
  - `MONGO_URI=<Atlas SRV URI>`
  - `JWT_SECRET=<long random secret>`
  - `CLIENT_URL=https://<frontend-production-origin>`
  - `FREE_DELIVERY_THRESHOLD=3000`
  - `STANDARD_DELIVERY_FEE=150`
- The API health endpoint is `/api/health`.

Example backend config:

```env
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://<user>:<password>@kokwet-groceries.<cluster>.mongodb.net/kokwet-groceries?retryWrites=true&w=majority
JWT_SECRET=<generate-a-long-random-secret>
CLIENT_URL=https://kokwet-groceries.pages.dev
FREE_DELIVERY_THRESHOLD=3000
STANDARD_DELIVERY_FEE=150
```

## 3. MongoDB Atlas setup

- Create a MongoDB Atlas cluster and a database user.
- Scope the user to the `kokwet-groceries` database only using a custom role.
- Do not use a broad role like `readWriteAnyDatabase` unless the project genuinely requires it.
- Copy the Atlas SRV URI as `MONGO_URI`.
- Allow the backend host to connect to the cluster.

## 4. GitHub + Render + Cloudflare flow

1. Create the repository on GitHub.
2. Connect the repo to Render for the backend service.
3. Connect the repo to Cloudflare Pages for the frontend service.
4. Use the deployed backend URL in the frontend `VITE_API_URL`.
5. Use the deployed frontend URL in the backend `CLIENT_URL`.

This is the exact trust boundary that keeps sales, auth, and uploads working in production:
frontend origin -> backend API -> MongoDB Atlas.

## 5. Uploaded files

Product and admin uploads are served from the backend's `uploads/` directory. The free Render
service has an ephemeral filesystem, so uploaded images can be lost on restart or deploy. Use a
paid persistent disk or move uploads to durable object storage before relying on uploaded images
in production.

## 6. Admin configuration check

- Set a real store phone number in Admin Settings to enable WhatsApp enquiries.
- The application does not use a placeholder contact number by default.
- If using social login, confirm the OAuth callback URLs match the deployed backend and
  storefront origins exactly.

## 7. Safaricom Daraja M-Pesa setup

The backend supports Daraja Lipa Na M-Pesa Express (STK Push). Configure these variables on
the backend host; never commit real keys, secrets, or passkeys to the repository.

For sandbox testing, create a Daraja sandbox app with the **Lipa Na M-Pesa Express** product,
then set:

```env
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=<consumer-key-from-your-sandbox-app>
MPESA_CONSUMER_SECRET=<consumer-secret-from-your-sandbox-app>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=<sandbox-passkey-from-daraja-test-credentials>
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=https://kokwet-groceries-api.onrender.com/api/orders/mpesa/callback
MPESA_CALLBACK_SECRET=<random-secret-at-least-32-characters>
```

Use the sandbox phone number shown under **Test Credentials** in Daraja when placing a test
order. Do not use the initiator credentials for STK Push. Once testing is successful, production
requires Safaricom approval and production app credentials; switch `MPESA_ENV` to `production`
only after replacing all sandbox values and verifying the production callback URL uses HTTPS.
For production, use the Safaricom-approved shortcode and passkey linked to the business
receiving account. Set `MPESA_TRANSACTION_TYPE=CustomerPayBillOnline` for a PayBill shortcode
or `CustomerBuyGoodsOnline` for a Till shortcode, according to the product registered by
Safaricom. `MPESA_SHORTCODE` is the official merchant shortcode; it is not the Pochi phone
number.

When all required values are configured, checkout sends an STK Push to the delivery phone
number. Daraja calls the public callback endpoint, and the backend verifies the result before
marking an order paid. The callback secret must be at least 32 characters and must match only
between the backend environment and its callback URL; keep it private.
The storefront separately displays the public Pochi la Biashara receiving number using
`VITE_MPESA_RECEIVING_NUMBER` (default `0793048318`). Configure it in Cloudflare Pages and
redeploy the frontend when changing that number; never put Daraja keys or passkeys in a `VITE_`
variable.
