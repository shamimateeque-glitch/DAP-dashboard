
-- Create a new storage bucket for branding assets
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Set up security policies for the branding bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'branding' );

create policy "Authenticated users can upload"
on storage.objects for insert
with check ( bucket_id = 'branding' and auth.role() = 'authenticated' );

create policy "Authenticated users can update"
on storage.objects for update
using ( bucket_id = 'branding' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete"
on storage.objects for delete
using ( bucket_id = 'branding' and auth.role() = 'authenticated' );
