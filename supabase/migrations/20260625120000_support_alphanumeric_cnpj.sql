-- Support the Receita Federal alphanumeric CNPJ format.
-- Existing numeric CNPJs remain valid because digits are part of the new format.

update public.exhibitor_companies
set cnpj = nullif(regexp_replace(upper(coalesce(cnpj, '')), '[^A-Z0-9]', '', 'g'), '')
where cnpj is not null;

drop index if exists uq_exhibitor_companies_cnpj_normalized;
create unique index if not exists uq_exhibitor_companies_cnpj_normalized
  on public.exhibitor_companies ((regexp_replace(upper(cnpj), '[^A-Z0-9]', '', 'g')))
  where cnpj is not null;

alter table public.exhibitor_companies
  drop constraint if exists chk_exhibitor_cnpj_digits;

alter table public.exhibitor_companies
  drop constraint if exists chk_exhibitor_cnpj_format;

alter table public.exhibitor_companies
  add constraint chk_exhibitor_cnpj_format
  check (cnpj is null or regexp_replace(upper(cnpj), '[^A-Z0-9]', '', 'g') ~ '^[A-Z0-9]{12}[0-9]{2}$');
