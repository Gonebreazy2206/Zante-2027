-- Migration: remove voting and add admins

alter table members
add column if not exists is_admin boolean not null default false;

update members
set is_admin = true
where lower(trim(name)) = 'nate';

create or replace function enforce_nate_admin()
returns trigger
language plpgsql
as $$
begin
  if lower(trim(new.name)) = 'nate' then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists members_nate_admin on members;

create trigger members_nate_admin
before insert or update of name, is_admin
on members
for each row
execute function enforce_nate_admin();

drop table if exists event_votes cascade;
drop table if exists votes cascade;
