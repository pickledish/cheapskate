-- The supabase/postgres image creates these roles without passwords the other
-- services know. Give them the test password at first init.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
