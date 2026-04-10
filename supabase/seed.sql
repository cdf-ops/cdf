-- Rode este seed depois de criar os usuários no Supabase Auth.
-- Ajuste os e-mails abaixo conforme seu time.

insert into public.user_profiles (id, role, status)
select id, 'super_adm', 'active'
from auth.users
where email = 'superadm@clubedofrio.com'
on conflict (id) do update
set role = excluded.role,
    status = excluded.status;

insert into public.user_profiles (id, role, status)
select id, 'organizador', 'active'
from auth.users
where email = 'organizador@clubedofrio.com'
on conflict (id) do update
set role = excluded.role,
    status = excluded.status;

insert into public.user_profiles (id, role, status)
select id, 'recepcao', 'active'
from auth.users
where email = 'recepcao@clubedofrio.com'
on conflict (id) do update
set role = excluded.role,
    status = excluded.status;

insert into public.user_profiles (id, role, status)
select id, 'expositor', 'active'
from auth.users
where email = 'expositor@clubedofrio.com'
on conflict (id) do update
set role = excluded.role,
    status = excluded.status;

