alter table service_groups
  add column if not exists context_id uuid;

alter table service_groups
  add constraint service_groups_context_fk
  foreign key (context_id) references contexts(id);

create index if not exists service_groups_context_id_idx
  on service_groups(context_id);
