# OmniCampus

OmniCampus is a campus management platform for students and administrators. It brings library circulation, student clubs, medical services, lost and found, profiles, and campus assistance into one application.

## Stack

- React 19 and TypeScript
- Vite and TanStack Start
- Supabase Auth, PostgreSQL, Row Level Security, and Storage
- React Router and TanStack Router runtime support
- Tailwind CSS
- Radix UI and Lucide icons
- Google Gemini through a server-only function

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- Optional: a Google Gemini API key for the AI assistant

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set the Supabase values in `.env`:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. Optionally set the server-only AI secret:

   ```env
   GEMINI_API_KEY=your-gemini-api-key
   ```

   Never prefix this variable with `VITE_`. Never expose a Supabase service-role key or Gemini key in client code.

## Database Setup

Run the migrations in `supabase/migrations` against the target Supabase project in filename order:

1. Initial schema and RLS policies
2. Public statistics RPC
3. Library admin policy correction
4. Library borrowing and returning workflow
5. Lost and found image storage
6. Lost and found resolution permissions
7. Profile academic level
8. Profile avatar storage

You can use the Supabase SQL Editor or the Supabase CLI. Apply the migrations before testing borrowing, image uploads, profile avatars, or owner/admin status changes.

## Development

Start the local development server:

```bash
npm run dev
```

The app is normally available at `http://localhost:5173`.

Run the production build:

```bash
npm run build
```

Run TypeScript validation:

```bash
npx tsc --noEmit
```

Run linting:

```bash
npm run lint
```

Format files:

```bash
npm run format
```

## Features

### Students

- Dashboard and profile management
- Library search, borrowing, loans, requests, and digital resources
- Club registry, memberships, events, RSVPs, and club resources
- Medical appointments, practitioners, pharmacy, and wellness resources
- Lost and found reports with image uploads, searchable reports, matching, and resolution actions
- Campus AI assistant

### Administrators

- Library inventory, loans, returns, acquisition requests, and resources
- Club registry, member rosters, events, event registrations, and resources
- Medical schedules, practitioners, pharmacy inventory, and wellness guides
- Role-aware navigation for `libadmin`, `clubadmin`, `medadmin`, and `superadmin`

## Roles

- `student`: student-facing campus services
- `libadmin`: library administration
- `clubadmin`: club and event administration
- `medadmin`: medical administration
- `superadmin`: access to all administration areas

Authorization is enforced through both protected routes and Supabase Row Level Security. Client-side route checks are not a substitute for database policies.

## Project Structure

```text
src/
  components/       Shared layout and UI components
  features/         Feature modules and pages
  integrations/     Supabase client and generated database types
  pages/            Public and authentication pages
  services/         Auth, campus data, tools, and server functions
  routes/           TanStack Start route shell
supabase/
  migrations/       Ordered database and storage migrations
```

## Deployment Notes

- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as client environment variables.
- Configure `GEMINI_API_KEY` only as a server environment variable.
- Apply all Supabase migrations before deploying the frontend.
- Verify RLS policies with test accounts for every role.
- Do not commit `.env` or any service credentials.
