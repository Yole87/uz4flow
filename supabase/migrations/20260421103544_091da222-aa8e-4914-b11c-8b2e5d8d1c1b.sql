drop policy if exists "admin_master read logs" on public.admin_notification_logs;
drop policy if exists "admin_master update logs" on public.admin_notification_logs;

create policy "admin_master read logs"
on public.admin_notification_logs
for select
to authenticated
using (public.is_admin_master());

create policy "admin_master update logs"
on public.admin_notification_logs
for update
to authenticated
using (public.is_admin_master())
with check (public.is_admin_master());