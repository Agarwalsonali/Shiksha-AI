# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

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
