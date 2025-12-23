This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Module 7 — Deployment Instructions (Vercel + Supabase Postgres)

### 1) Create a Supabase Postgres database

1. Create a Supabase project.
2. In Supabase, grab your Postgres connection string.
	 - Use the **direct** connection string to keep things simple.
	 - This app connects using `pg` (via Prisma's Postgres adapter) and enables SSL automatically in production.

### 2) Prepare the database schema locally

From your machine (with `DATABASE_URL` pointing at Supabase):

```bash
npm run lint
npx prisma migrate dev
```

This creates migrations in `prisma/migrations/`.

### 3) Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. In Vercel → **Project Settings** → **Environment Variables**, set:

**Required**
- `DATABASE_URL` — Supabase Postgres connection string
- `NEXTAUTH_SECRET` — long random secret used to sign JWTs
- `NEXTAUTH_URL` — your Vercel URL, e.g. `https://your-app.vercel.app`

**Optional**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — only if enabling Google OAuth
- `ADMIN_REGISTRATION_SECRET` — if you allow admin self-registration via admin code

4. Set the Vercel **Build Command** to run migrations before the build:

```bash
npx prisma migrate deploy && npm run build
```

Vercel will run `npm install` first; this repo also runs `prisma generate` via `postinstall`.

### 4) NextAuth notes (so login works in production)

- `NEXTAUTH_URL` must match the deployed domain (https). This affects cookies and callback URLs.
- For Google OAuth, add the correct Authorized redirect URI in Google Cloud Console:
	- `https://your-app.vercel.app/api/auth/callback/google`

### 5) Verify after deployment

- Visit `/auth/register` and create a user.
- Login at `/auth/login`.
- Visit `/admin` as an admin user (your middleware enforces RBAC).
- Create a quiz in `/admin/quizzes`, add questions, then open `/quiz?id=<quizId>`.
