# API Masking Panel

Secure, self-hosted API masking & control panel.  
Built with Next.js + TypeScript + JSON file database (no external database required).

## Features
- Admin-only login (password)
- Create masked APIs (hide real URL + real key)
- Validity (days / permanent)
- Rate limiting (unlimited / daily / monthly)
- Usage tracking & logs
- One-click copy masked URL
- Clean dashboard

## Your Side – Setup Guide

### 1. Download / Clone the project
Copy the entire `api-masking-panel` folder to your computer.

### 2. Install dependencies
```bash
cd api-masking-panel
npm install
```

### 3. Create environment file
```bash
cp .env.local.example .env.local
```

Open `.env.local` and set a strong secret:
```
JWT_SECRET=make-this-a-very-long-random-string-at-least-32-characters
```

### 4. Run locally
```bash
npm run dev
```

Open http://localhost:3000

**Default password:** `admin123`  
Change it after first login (we will add change-password UI next).

### 5. How the Masked URL works
When you create an API named `openai-gpt4`, the panel generates a slug (example: `openai-gpt4`).

Your masked endpoint becomes:
```
https://your-domain.com/api/proxy/openai-gpt4
```

Anyone calling this URL will be proxied to your real API. The real URL and real key never leave the server.

### 6. Deploy to Vercel (Free)
1. Push the project to a **private** GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo
3. Add Environment Variable:
   - Name: `JWT_SECRET`
   - Value: same long random string
4. Deploy

**Important note about JSON database on Vercel:**
- Vercel serverless functions have an ephemeral filesystem.
- Data written to `data/db.json` can be lost on cold starts or new deployments.
- For personal low-traffic use this is often acceptable.
- For stronger persistence later we can move to a free Postgres or use a platform with disk (Render, Railway, Fly.io).

### 7. First actions after login
1. Create your first masked API
2. Copy the masked URL
3. Test it (you can use the browser, Postman, or curl)
4. Change the default admin password (feature coming in next update)

## Project Structure
```
api-masking-panel/
├── data/db.json          ← auto-created database
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── dashboard/
│   │   └── api/
│   │       ├── auth/
│   │       ├── apis/
│   │       └── proxy/[slug]/   ← the actual masker
│   └── lib/
│       ├── db.ts         ← JSON database logic
│       ├── auth.ts
│       └── types.ts
```

## Security Notes
- Admin password is hashed with bcrypt
- Real API keys are never sent to the browser
- JWT session cookie is httpOnly
- Rate limits & expiry are enforced on every proxy request

---

Next updates I will add:
- Change password
- Enable/Disable toggle
- Edit API
- Client key generation
- Built-in API tester
- Better logs filtering
