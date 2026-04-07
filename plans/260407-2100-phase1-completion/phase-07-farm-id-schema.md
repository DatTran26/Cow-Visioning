# Phase 07 — Add farm_id Column to Schema

## Context Links
- `schema.sql` (root) — current cow_images table definition, no farm_id
- `database/schema.sql` — duplicate schema file (same content)
- `docs/project-overview-pdr.md` — PDR requires farm_id support

## Overview
- **Priority**: P2
- **Status**: Completed
- **Group**: C (parallel with Group B; parallel with Phase 08)
- **Description**: Add nullable `farm_id` column to cow_images, users, blog_posts, app_config + migration SQL. Enforcement deferred to Phase 2.
<!-- Updated: Validation Session 1 - expanded from cow_images only to all relevant tables -->

## Key Insights
- PDR specifies farm_id as a schema requirement but enforcement (NOT NULL, FK to farms table) is Phase 2
- Column must be nullable — backward compatible with all existing data
- Two identical schema.sql files exist: `schema.sql` (root) and `database/schema.sql` — both need updating
- No `farms` table exists yet — farm_id is a VARCHAR for now (can become FK in Phase 2)

## Requirements

### Functional
- `farm_id VARCHAR(100) NULL` added to: cow_images, users, blog_posts, app_config
- Migration SQL is idempotent (`ADD COLUMN IF NOT EXISTS`)
- Both schema.sql files updated
- farm_id indexed on cow_images, users, blog_posts (high-query tables)

### Non-Functional
- Migration must not break existing rows (nullable, no default required)
- Migration must be safe to run multiple times (idempotent)
- No application code changes required (Phase 2 handles API + UI)

## Architecture

### Migration SQL
```sql
-- cow_images
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_cow_images_farm_id ON cow_images (farm_id);

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_users_farm_id ON users (farm_id);

-- blog_posts
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_blog_posts_farm_id ON blog_posts (farm_id);

-- app_config
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
```

### Data Flow
- No data flow changes in Phase 1
- Column sits empty/null until Phase 2 adds API support

## Related Code Files

### Modify
- `schema.sql` (root) — add farm_id column + index
- `database/schema.sql` — same changes (keep in sync)

### Create
- `migrations/001-add-farm-id.sql` — standalone migration file for deployment

## Implementation Steps

1. **Create `migrations/` directory** if not exists

2. **Create `migrations/001-add-farm-id.sql`**:
   ```sql
   -- Migration: Add farm_id to all relevant tables
   -- Safe to run multiple times (idempotent)
   -- Phase 1: nullable column, no FK constraint
   -- Phase 2: will add farms table + FK + NOT NULL enforcement

   ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
   CREATE INDEX IF NOT EXISTS idx_cow_images_farm_id ON cow_images (farm_id);
   COMMENT ON COLUMN cow_images.farm_id IS 'Farm identifier. Nullable in Phase 1.';

   ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
   CREATE INDEX IF NOT EXISTS idx_users_farm_id ON users (farm_id);
   COMMENT ON COLUMN users.farm_id IS 'Farm identifier. Nullable in Phase 1.';

   ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
   CREATE INDEX IF NOT EXISTS idx_blog_posts_farm_id ON blog_posts (farm_id);
   COMMENT ON COLUMN blog_posts.farm_id IS 'Farm identifier. Nullable in Phase 1.';

   ALTER TABLE app_config ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
   COMMENT ON COLUMN app_config.farm_id IS 'Farm identifier. Nullable in Phase 1.';
   ```

3. **Update `schema.sql` (root)** — add after existing ALTER TABLE statements (around line 27):
   ```sql
   ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
   ```
   Add index after existing indexes (around line 37):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_cow_images_farm_id ON cow_images (farm_id);
   ```

4. **Update `database/schema.sql`** — same changes as root schema.sql

5. **Verify** migration runs cleanly:
   ```bash
   psql -U cowapp -d cow_visioning -f migrations/001-add-farm-id.sql
   ```

## Todo List

- [ ] Create migrations/ directory
- [ ] Create migrations/001-add-farm-id.sql
- [ ] Update schema.sql (root) with farm_id column + index
- [ ] Update database/schema.sql with farm_id column + index
- [ ] Verify migration is idempotent (run twice without error)

## Success Criteria
- `\d cow_images`, `\d users`, `\d blog_posts`, `\d app_config` each show `farm_id VARCHAR(100)` column
- Indexes exist on cow_images, users, blog_posts
- Migration can run multiple times without error
- Both schema.sql files are consistent
- No existing queries or routes break (columns are nullable, not referenced)

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Migration fails on production DB | Idempotent SQL (IF NOT EXISTS); test on dev first |
| Two schema files diverge | Update both in same commit; add comment noting duplication |
| farm_id type changes in Phase 2 | VARCHAR(100) is flexible; Phase 2 can ALTER TYPE if needed |

## Security Considerations
- No sensitive data — farm_id is an identifier
- No access control changes

## File Ownership
```
schema.sql (root — farm_id lines only)
database/schema.sql (farm_id lines only)
migrations/001-add-farm-id.sql (CREATE)
```

## Next Steps
- Phase 2 will create `farms` table, add FK constraint, update API to accept/return farm_id
