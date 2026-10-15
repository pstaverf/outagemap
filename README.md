# OutageMap

Initial implementation of a Russian-language, map-first civic issue tracker for Kazakhstan and Russia. This is an incomplete foundation, not a production-ready implementation of the full specification.

## Architecture

- `prisma/schema.prisma`: PostgreSQL data model and initial SQL migration
- `src/lib`: shared Zod schemas, typed client requests, map-provider configuration
- `src/server`: authentication, database access, issue business rules, Redis rate limits, HTTP error envelopes
- `src/app/api`: issue search/creation, reactions, reports, moderation, reviews, account export/deletion, geocoding and health
- `src/components`: responsive map, list, filters, accessible Radix dialogs and validated creation form
- `src/app`: application shell, issue pages, login, profile and policy pages

MapLibre is dynamically imported. Issues load by debounced bounding box, with clustering and cursor pagination. Reaction changes lock the issue row in a transaction; the compound primary key prevents duplicate user reactions. Three affected reactions confirm an issue. Mutations verify session and account status on the server, and API mutations enforce same-origin requests. Account deletion cascades through owned content.

## Local setup

Requires Node.js 22+, Docker Compose, and network access to npm and Prisma engine downloads.

```sh
npm ci
cp .env.example .env
openssl rand -base64 32
```

Set `AUTH_SECRET` to the generated value. Configure Google OAuth credentials for Google login; local email login uses Mailpit. Register the callback `/api/auth/callback/google` in the OAuth provider.

```sh
docker compose up -d
npx prisma generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and http://localhost:8025 for local email. Health endpoint: `/api/health` checks PostgreSQL and Redis. No fabricated outage reports are inserted into the database.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

Production requires HTTPS, a strong secret, working SMTP, provider credentials, and appropriate database placement. The Compose configuration is for local development only, not production deployment. Never enable `AUTH_TRUST_HOST` behind an untrusted host-header forwarding proxy.

## Current limitations and release blockers

- S3 image upload, image processing, EXIF removal and signed URLs are not implemented.
- Local GeoLite2/IP lookup and trusted-proxy configuration are not implemented; the initial location defaults to Almaty and can be selected manually.
- Hybrid labels and 3D building interaction are not implemented. Satellite works only when a licensed tile URL and attribution are configured. Hybrid currently uses the satellite raster style without labels.
- Nearby duplicate detection, reaction removal in the UI, closed-issue suggestions, review UI, moderator dashboard, user blocking UI, and full profile management remain unimplemented.
- The login return flow resumes issue creation only; it does not replay a reaction. There is no remember-me option or verified-email account-linking flow.
- Complete Kazakhstan/Russia data-residency routing, legal/operator details, strict nonce-based CSP, IP rate limiting, Kazakh translation, bundled Cyrillic font, production shutdown handling, tile caching and realistic development seed remain unimplemented.
- The saved map position is written but not restored. City persistence currently uses local storage rather than a cookie. Direct links depend on the issue being loaded in the current bounding box.
- Issue list counts describe loaded records, not total matching records. Filtering by period/region and sorting by confirmation count are not implemented.
- Audit retention on account deletion needs a separate legal/data-retention decision.
- Dependency audit reports unresolved vulnerabilities, including Auth.js. Do not expose this build publicly until dependencies and security controls are reviewed.

## Validation in the Arena environment

`npm run lint` and `npm run typecheck` pass. TypeScript uses `strict`, unused-code checks and `skipLibCheck` because upstream dependency declarations contain incompatible optional-provider types.

Next.js production compilation, lint, type checks, and page generation completed with build-only engine path overrides. However, the environment blocks `binaries.prisma.sh`; native Prisma engines could not be downloaded. The override is not a working engine and is not part of the project configuration. Runtime database operations, migration execution, authentication, Redis workflows, external map/geocoding requests and browser end-to-end behavior have not been verified. Build logs emitted Prisma initialization errors with that override; the successful build exit code must not be interpreted as successful database validation.

The migration is supplied as SQL but has not been executed against PostgreSQL here. No production-readiness or legal-compliance claim is made.
