-- O portal do patrocinador possui autenticação própria. O perfil expositor deixa
-- de ser atribuível e os acessos legados ficam inativos, preservando a auditoria.
update public.user_profiles
set role = 'recepcao', status = 'inactive'
where role = 'expositor';

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_adm', 'organizador', 'recepcao', 'sorteador'));
