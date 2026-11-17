create index idx_event_ambassadors_created_by
  on public.event_ambassadors (created_by)
  where created_by is not null;

create index idx_event_ambassadors_updated_by
  on public.event_ambassadors (updated_by)
  where updated_by is not null;

create index idx_ambassador_entry_checkins_operator
  on public.ambassador_entry_checkins (operator_user_id);

create index idx_ambassador_entry_checkins_deleted_by
  on public.ambassador_entry_checkins (deleted_by)
  where deleted_by is not null;
