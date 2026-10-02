-- Extensions the platform relies on.
-- citext: case-insensitive usernames without lower() on every lookup.
-- pg_trgm: fast ILIKE search over Arabic student names in the admin table.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
