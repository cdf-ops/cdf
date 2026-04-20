-- Phase E - exhibitor profiles and global management fields

alter table public.exhibitor_companies
  add column if not exists trade_name text null,
  add column if not exists legal_name text null,
  add column if not exists cnpj text null,
  add column if not exists phone text null,
  add column if not exists email text null,
  add column if not exists contact_name text null,
  add column if not exists notes text null;

update public.exhibitor_companies
set
  trade_name = coalesce(nullif(trade_name, ''), name),
  legal_name = coalesce(nullif(legal_name, ''), name),
  cnpj = nullif(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), ''),
  phone = nullif(phone, ''),
  email = nullif(lower(trim(coalesce(email, ''))), ''),
  contact_name = nullif(contact_name, ''),
  notes = nullif(notes, '')
where true;

drop index if exists uq_exhibitor_companies_cnpj_normalized;
create unique index if not exists uq_exhibitor_companies_cnpj_normalized
  on public.exhibitor_companies ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null;

alter table public.exhibitor_companies
  drop constraint if exists chk_exhibitor_cnpj_digits;
alter table public.exhibitor_companies
  add constraint chk_exhibitor_cnpj_digits
  check (cnpj is null or regexp_replace(cnpj, '\D', '', 'g') ~ '^[0-9]{14}$');
