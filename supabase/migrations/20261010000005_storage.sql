-- DjiHealth demo — private document storage (M2). Path convention: '<patient_id>/<uuid>-<filename>'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "documents: read if record accessible" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and public.can_read_patient(nullif((storage.foldername(name))[1], '')::uuid));

create policy "documents: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and public.is_record_owner(nullif((storage.foldername(name))[1], '')::uuid));

create policy "documents: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and public.is_record_owner(nullif((storage.foldername(name))[1], '')::uuid));
