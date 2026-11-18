-- GETEK Rectifier Testing Management System: schema, RLS, storage, audit
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  employee_id text unique,
  email text not null,
  role text not null default 'engineer' check (role in ('admin','engineer')),
  department text default 'Testing',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_settings (key text primary key, value text not null);
insert into public.app_settings values ('edit_window_hours','24');

create table public.rating_options (
  id uuid primary key default gen_random_uuid(),
  rating_name text not null unique,
  is_active boolean not null default true
);
insert into public.rating_options(rating_name) values
 ('12V 1000A'),('24V 1000A'),('12V 1500A'),('24V 1500A'),('24V 5000A');

create table public.rectifier_records (
  id uuid primary key default gen_random_uuid(),
  engineer_id uuid not null references public.profiles(id),
  testing_date date not null default current_date,
  fo_number text not null,
  series_number text not null,
  rectifier_rating text not null,
  quantity integer not null check (quantity > 0),
  no_load_status text not null default 'not_started' check (no_load_status in ('not_started','in_progress','completed','failed')),
  short_circuit_status text not null default 'not_started' check (short_circuit_status in ('not_started','in_progress','completed','failed')),
  load_test_status text not null default 'not_started' check (load_test_status in ('not_started','in_progress','completed','failed')),
  remarks text,
  submission_status text not null default 'draft' check (submission_status in ('draft','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.rectifier_records(engineer_id, testing_date);
create index on public.rectifier_records(testing_date);
create index on public.rectifier_records(fo_number);
create index on public.rectifier_records(series_number);

create table public.technical_problems (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.rectifier_records(id) on delete cascade,
  reported_by uuid not null references public.profiles(id),
  category text not null check (category in ('Voltage Problem','Current Problem','Rectifier Not Starting','Cooling Fan Problem','Control Card Problem','PCB Problem','Transformer Problem','Diode / SCR Problem','Output Fluctuation','Overheating','Other')),
  description text not null,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  image_url text,
  problem_status text not null default 'open' check (problem_status in ('open','under_investigation','resolved')),
  assigned_to text,
  resolution_remarks text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.technical_problems(record_id);
create index on public.technical_problems(problem_status);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Helper functions ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

create or replace function public.can_edit_record(rec public.rectifier_records) returns boolean
language sql stable security definer set search_path = public as $$
  select rec.engineer_id = auth.uid() and (
    rec.submission_status = 'draft'
    or now() - rec.created_at < make_interval(hours => coalesce((select value::int from app_settings where key='edit_window_hours'), 24))
  )
$$;

-- New auth user -> profile. Role is ALWAYS engineer here (no escalation via metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, employee_id, email, department)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          nullif(new.raw_user_meta_data->>'employee_id',''),
          new.email,
          coalesce(new.raw_user_meta_data->>'department','Testing'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_touch before update on public.rectifier_records
  for each row execute function public.touch_updated_at();

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs(user_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          case when tg_op='DELETE' then old.id else new.id end,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger trg_audit_records after insert or update or delete on public.rectifier_records
  for each row execute function public.audit();
create trigger trg_audit_problems after insert or update or delete on public.technical_problems
  for each row execute function public.audit();

-- Engineers cannot touch admin-only problem fields
create or replace function public.guard_problem_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    new.assigned_to := old.assigned_to;
    new.resolution_remarks := old.resolution_remarks;
    new.resolved_at := old.resolved_at;
    new.reported_by := old.reported_by;
    new.record_id := old.record_id;
  end if;
  return new;
end $$;
create trigger trg_guard_problem before update on public.technical_problems
  for each row execute function public.guard_problem_update();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.rating_options enable row level security;
alter table public.rectifier_records enable row level security;
alter table public.technical_problems enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles admin update" on profiles for update using (is_admin()) with check (is_admin());

create policy "settings read" on app_settings for select using (auth.uid() is not null);
create policy "settings admin write" on app_settings for all using (is_admin()) with check (is_admin());

create policy "ratings read" on rating_options for select using (auth.uid() is not null);
create policy "ratings admin write" on rating_options for all using (is_admin()) with check (is_admin());

create policy "records select" on rectifier_records for select
  using (is_admin() or (engineer_id = auth.uid() and is_active_user()));
create policy "records insert own" on rectifier_records for insert
  with check (engineer_id = auth.uid() and is_active_user());
create policy "records update" on rectifier_records for update
  using (is_admin() or (is_active_user() and can_edit_record(rectifier_records)))
  with check (is_admin() or engineer_id = auth.uid());
create policy "records admin delete" on rectifier_records for delete using (is_admin());

create policy "problems select" on technical_problems for select
  using (is_admin() or (reported_by = auth.uid() and is_active_user()));
create policy "problems insert own" on technical_problems for insert
  with check (reported_by = auth.uid() and is_active_user()
    and exists (select 1 from rectifier_records r where r.id = record_id and r.engineer_id = auth.uid()));
create policy "problems update" on technical_problems for update
  using (is_admin() or (reported_by = auth.uid() and is_active_user()))
  with check (is_admin() or reported_by = auth.uid());
create policy "problems admin delete" on technical_problems for delete using (is_admin());

create policy "audit admin read" on audit_logs for select using (is_admin());

-- ---------- Storage: private bucket, files stored under <user_id>/ ----------
insert into storage.buckets (id, name, public) values ('problem-images','problem-images', false)
  on conflict (id) do nothing;
create policy "img upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='problem-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy "img read own or admin" on storage.objects for select to authenticated
  using (bucket_id='problem-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "img admin delete" on storage.objects for delete to authenticated
  using (bucket_id='problem-images' and public.is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.rectifier_records, public.technical_problems;

-- ---------- First admin ----------
-- 1) Supabase Dashboard > Authentication > Users > Add user (tick Auto Confirm).
-- 2) Run: update public.profiles set role='admin', full_name='Testing Manager' where email='manager@getek.com';
