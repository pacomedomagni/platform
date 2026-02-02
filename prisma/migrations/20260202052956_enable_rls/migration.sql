-- Enable RLS on users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- Create policy for users
-- This ensures that any SELECT/UPDATE/DELETE only sees rows where tenantId matches the session variable
CREATE POLICY tenant_isolation_policy ON "users"
    USING ("tenantId" = current_setting('app.tenant', true));

-- Note: We might want a "Bypass" policy for system background jobs if needed, 
-- but for now strict isolation is the goal.