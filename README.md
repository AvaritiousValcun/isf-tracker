# ISF Tracker

## Overview
ISF Tracker is a continuous hormone monitoring prototype designed for secure, patient-centric health tracking. It visualizes interstitial fluid (ISF) hormone levels (Androgen and Progesterone), facilitates secure messaging with registered consultants, and offers predictive analytics for long-term health monitoring.

## Architecture
This is a full-stack monolithic single-page application (SPA).
- **Frontend**: A React application utilizing Vite, rendering dynamic charts, handling localization (English & Kiswahili), and establishing secure UI flows based on permissions.
- **Backend**: An Express.js Node API, handling sensitive logic such as WebAuthn/Passkey registration, subscription payment flows, trend processing, and consultant messaging authorization.
- **Database**: Supabase PostgreSQL database employing strict Row-Level Security (RLS) to enforce patient data isolation.

## Technology stack
- **Frontend**: React 18, Vite, React Router 6, Tailwind CSS, Radix UI, Recharts, i18next
- **Backend**: Express.js, TypeScript, SimpleWebAuthn
- **Database / Auth**: Supabase (PostgreSQL), JWT-based Authentication
- **Testing**: Vitest

## Project structure
- /client: React SPA frontend source code
- /server: Express API backend and background worker services
- /shared: Types and APIs shared across client and server
- /supabase/migrations: Authoritative PostgreSQL schema and RLS policies

## Environment variables
Create a \.env\ file in the root based on \.env.example\:

\\\
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NODE_ENV=development
PORT=3000
WEBAUTHN_RP_NAME=ISF Tracker
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:8080
\\\

## Supabase setup
Ensure your Supabase instance is created. Take note of your Project URL, Anon Key, and Service Role Key, adding them to the \.env\ file.

## Database setup
Database structures are managed via Supabase Migrations.
Run the migrations sequentially on your Supabase instance using the Supabase CLI:
\\\ash
supabase db push
\\\

## Authentication
Primary authentication leverages Supabase's native Auth mechanisms. However, the application routes sensitive API calls through the Express backend securely by extracting the Bearer token and verifying it against the Supabase Admin client.

## Passkey/WebAuthn setup
The application supports biometric and device-bound passkeys.
If deploying to production, \WEBAUTHN_RP_ID\ must exactly match your HTTPS domain (e.g. \	racker.example.com\), and \WEBAUTHN_ORIGIN\ must exactly match your URL (e.g. \https://tracker.example.com\). Passwordless session restoration utilizes the backend \/api/passkey\ routes.

## Payment setup
The \/api/subscription/checkout\ and \/api/subscription/webhook\ endpoints are designed to accept integrations from Mobile Money (M-Pesa) or standard card providers. Ensure appropriate provider credentials are injected into the environment once the specific provider is selected.

## Development
To start the application in development mode (which hot-reloads both frontend and backend concurrently):
\\\ash
npm run dev
\\\

## Frontend startup
The frontend runs alongside the backend during development via Vite. In production, the built static files should be served via a standard web server or CDN.

## Backend startup
To start the Express server independently:
\\\ash
npm run start
\\\

## Production build
To compile the frontend application for deployment:
\\\ash
npm run build
\\\

## Demo data
Demo data provisioning scripts are available (e.g., \create-test-user.ts\).

## Testing
Run the test suite using Vitest:
\\\ash
npm test
\\\

## Troubleshooting
- **Database errors**: Ensure all migrations in \supabase/migrations\ have been applied.
- **Auth/Passkey failures**: Verify the domain configurations in the environment block matching exactly to your origin.
- **Port conflicts**: The application binds to 8080 for development. If 8080 is occupied, adjust \ite.config.ts\.

## Security
- The Supabase Service Role key MUST NEVER be exposed to the frontend environment.
- RLS policies restrict patient data access globally.
- Avoid modifying the authentication/authorization middlewares locally just to bypass errors.

## Predictive-analysis limitations
The predictive models (PMOS, Insulin Resistance, Hypertension) present in this application are for demonstration purposes only. They are not clinically validated and their synthetic calculations reflect arbitrary risk matrices for UI testing.

## Medical disclaimer
ISF Tracker is a software prototype and decision-support tool. It is not intended for clinical diagnosis. The analytical features provide qualitative estimates, not definitive medical diagnoses. Always consult a certified healthcare professional.
