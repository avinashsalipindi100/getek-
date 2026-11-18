-- Update 2: order quantity per FO, safer profile names
alter table public.rectifier_records
  add column if not exists ordered_quantity integer check (ordered_quantity is null or ordered_quantity > 0);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, employee_id, email, department)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)),
          nullif(new.raw_user_meta_data->>'employee_id',''),
          new.email,
          coalesce(new.raw_user_meta_data->>'department','Testing'))
  on conflict (id) do nothing;
  return new;
end $$;

update public.profiles set full_name = split_part(email,'@',1) where coalesce(trim(full_name),'') = '';
