# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Gemini configuration

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` locally. The key is
server-only and must not be added to frontend environment variables, source
files, logs, or commits.

The default model is `gemini-3.8-flash`. Override it with `GEMINI_MODEL`,
`GEMINI_MODEL_TUTOR`, `GEMINI_MODEL_UTILITY`, or `GEMINI_MODEL_PLANNER` when
needed. `gemini-2.5-flash` is retired for new API projects; if the configured
model is unavailable, the service asks the API which models the key may use and
switches automatically, logging a warning with the replacement model name.

Free-tier keys enforce a small **per-model daily request cap** (e.g. 20 requests
per day for `gemini-3.8-flash`). When a model's daily quota is exhausted the
service switches to another available model instead of failing; if every model
is exhausted the API returns a clear quota message. Enable billing on the key
for production use.

`GEMINI_THINKING_BUDGET` (default `0`) disables Gemini 3's reasoning pass for
fast structured output; set it higher if you prefer more deliberation.
`GEMINI_TIMEOUT_MS` (default `120000`) bounds each request. Transient 429/503
responses are retried twice with backoff.

## NCERT retrieval (RAG)

Retrieval uses the gRPC-based `weaviate-client`. Weaviate Cloud no longer serves
the GraphQL API, so `weaviate-ts-client` was removed. If the configured cluster
does not contain the `NCERTChunks` collection, retrieval is skipped with a single
warning and generation continues without retrieved context.

Populate the collection with the Python pipeline in `../embedding` (it reads
`WEAVIATE_URL`, `WEAVIATE_API_KEY`, `GOOGLE_API_KEY` and
defaults to `gemini-embedding-001`):

```bash
cd embedding
uv run main.py
```

Verify retrieval through the development-only endpoint:

```bash
curl http://localhost:3000/debug/rag
```

Install dependencies and validate the backend with:

```bash
bun install
bun run type-check
bun run build
```

## Database setup

The backend requires the Supabase schema before authentication and application
routes can be used. In the Supabase SQL Editor, run these migrations in order:

1. `migrations/01_schema.sql`
2. `migrations/02_full_schema.sql`
3. `migrations/03_tutor_enhancements.sql`

After applying them, reload PostgREST's schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

Then verify the backend:

```bash
curl http://localhost:3000/health
```

The response should report `"status": "healthy"` and
`"database": "connected"`.
