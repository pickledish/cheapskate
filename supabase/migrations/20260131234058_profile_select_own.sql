-- Allow users to always view their own profile
-- (Required for family changes: PostgREST returns the updated row,
-- which fails if the only SELECT policy checks family_id)

create policy "Users can view own profile"
    on profiles for select
    using (id = auth.uid());
