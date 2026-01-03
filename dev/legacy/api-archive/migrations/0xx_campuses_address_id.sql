begin;

alter table campuses
  add column if not exists address_id uuid;

alter table campuses
  add constraint campuses_address_id_fkey
  foreign key (address_id) references addresses(id)
  on delete set null;

create index if not exists idx_campuses_address_id on campuses(address_id);

commit;
