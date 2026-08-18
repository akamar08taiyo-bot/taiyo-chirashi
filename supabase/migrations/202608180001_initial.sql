-- 太陽シルバーサービス 事例集・チラシ作成アプリ
-- Initial production schema for Supabase/PostgreSQL.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('employee','office_admin','org_admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.share_scope as enum ('private','office','company');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.page_orientation as enum ('portrait','landscape');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.design_style as enum ('standard','simple','soft','product');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.media_kind as enum ('product','case');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  address text not null default '',
  phone text not null default '',
  fax text not null default '',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  address text not null default '',
  phone text not null default '',
  fax text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  office_id uuid not null references public.offices(id) on delete restrict,
  employee_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  phone text not null default '',
  flyer_contact_name text not null default '',
  mobile_phone text not null default '',
  role public.app_role not null default 'employee',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9_-]+$'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categories_global_slug_uq on public.categories(slug) where organization_id is null;
create unique index if not exists categories_org_slug_uq on public.categories(organization_id,slug) where organization_id is not null;

create table if not exists public.design_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  style public.design_style not null,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flyers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  office_id uuid not null references public.offices(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  title text not null default '無題の事例集' check (char_length(title) <= 200),
  category_id uuid not null references public.categories(id) on delete restrict,
  share_scope public.share_scope not null default 'private',
  orientation public.page_orientation not null default 'portrait',
  layout_count smallint not null default 9 check (layout_count in (1,2,3,4,6,9)),
  design_style public.design_style not null default 'standard',
  main_color text not null default '#8b5e3c' check (main_color ~ '^#[0-9A-Fa-f]{6}$'),
  editor_state jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  office_id uuid references public.offices(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  category_id uuid not null references public.categories(id) on delete restrict,
  share_scope public.share_scope not null default 'private',
  editor_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  office_id uuid not null references public.offices(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind public.media_kind not null,
  share_scope public.share_scope not null default 'private',
  category text not null default '',
  manufacturer text not null default '',
  product_name text not null default '',
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  original_path text not null unique,
  preview_path text not null unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Query/index paths used by home, trash, template and media screens.
create index if not exists offices_org_active_idx on public.offices(organization_id,is_active);
create index if not exists profiles_org_office_active_idx on public.profiles(organization_id,office_id,is_active);
create index if not exists flyers_org_updated_idx on public.flyers(organization_id,updated_at desc) where deleted_at is null;
create index if not exists flyers_office_updated_idx on public.flyers(office_id,updated_at desc) where deleted_at is null;
create index if not exists flyers_owner_updated_idx on public.flyers(owner_id,updated_at desc) where deleted_at is null;
create index if not exists flyers_deleted_idx on public.flyers(organization_id,deleted_at desc) where deleted_at is not null;
create index if not exists templates_org_updated_idx on public.templates(organization_id,updated_at desc) where deleted_at is null;
create index if not exists templates_office_updated_idx on public.templates(office_id,updated_at desc) where deleted_at is null;
create index if not exists media_org_created_idx on public.media(organization_id,created_at desc) where deleted_at is null;
create index if not exists media_office_created_idx on public.media(office_id,created_at desc) where deleted_at is null;
create index if not exists media_product_search_idx on public.media(organization_id,kind,category,product_name) where deleted_at is null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create or replace trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create or replace trigger offices_touch before update on public.offices for each row execute function public.touch_updated_at();
create or replace trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create or replace trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create or replace trigger design_presets_touch before update on public.design_presets for each row execute function public.touch_updated_at();
create or replace trigger templates_touch before update on public.templates for each row execute function public.touch_updated_at();

-- RLS helper functions are SECURITY DEFINER so profiles RLS cannot recurse.
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path=public as $$
  select organization_id from public.profiles where id=auth.uid() and is_active limit 1
$$;
create or replace function public.current_office_id()
returns uuid language sql stable security definer set search_path=public as $$
  select office_id from public.profiles where id=auth.uid() and is_active limit 1
$$;
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and is_active limit 1
$$;
create or replace function public.can_access_scope(p_owner uuid,p_org uuid,p_office uuid,p_scope public.share_scope)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and public.current_org_id()=p_org and (
    auth.uid()=p_owner
    or (p_scope<>'private' and public.current_app_role()='org_admin')
    or p_scope='company'
    or (p_scope='office' and public.current_office_id()=p_office)
  )
$$;
create or replace function public.can_manage_office(p_office uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_app_role()='org_admin' or (public.current_app_role()='office_admin' and public.current_office_id()=p_office)
$$;

revoke all on function public.current_org_id() from public;
revoke all on function public.current_office_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.can_access_scope(uuid,uuid,uuid,public.share_scope) from public;
revoke all on function public.can_manage_office(uuid) from public;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_office_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_access_scope(uuid,uuid,uuid,public.share_scope) to authenticated;
grant execute on function public.can_manage_office(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.design_presets enable row level security;
alter table public.flyers enable row level security;
alter table public.templates enable row level security;
alter table public.media enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations for select to authenticated using (id=public.current_org_id());
create policy organizations_update on public.organizations for update to authenticated using (id=public.current_org_id() and public.current_app_role()='org_admin') with check (id=public.current_org_id());

create policy offices_select on public.offices for select to authenticated using (organization_id=public.current_org_id());
create policy offices_update on public.offices for update to authenticated using (organization_id=public.current_org_id() and public.can_manage_office(id)) with check (organization_id=public.current_org_id() and public.can_manage_office(id));
create policy offices_insert on public.offices for insert to authenticated with check (organization_id=public.current_org_id() and public.current_app_role()='org_admin');

create policy profiles_select on public.profiles for select to authenticated using (
  organization_id=public.current_org_id() and (id=auth.uid() or office_id=public.current_office_id() or public.current_app_role()='org_admin')
);
-- Employees can remember only their own flyer contact name/mobile number through this narrow RPC.
-- Role, office, employee ID and account-active state remain protected from direct self-editing.
create or replace function public.update_my_flyer_contact(p_contact_name text,p_mobile_phone text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.profiles
     set flyer_contact_name=left(trim(coalesce(p_contact_name,'')),100),
         mobile_phone=left(trim(coalesce(p_mobile_phone,'')),40)
   where id=auth.uid() and is_active;
end $$;
revoke all on function public.update_my_flyer_contact(text,text) from public;
grant execute on function public.update_my_flyer_contact(text,text) to authenticated;

-- Profile writes are intentionally server/admin-function only. Retired staff records are retained.

create policy categories_select on public.categories for select to authenticated using (organization_id is null or organization_id=public.current_org_id());
create policy categories_insert on public.categories for insert to authenticated with check (organization_id=public.current_org_id() and public.current_app_role()='org_admin');
create policy categories_update on public.categories for update to authenticated using (organization_id=public.current_org_id() and public.current_app_role()='org_admin') with check (organization_id=public.current_org_id());

create policy design_presets_select on public.design_presets for select to authenticated using (organization_id is null or organization_id=public.current_org_id());
create policy design_presets_manage on public.design_presets for all to authenticated using (organization_id=public.current_org_id() and public.current_app_role()='org_admin') with check (organization_id=public.current_org_id() and public.current_app_role()='org_admin');

create policy flyers_select on public.flyers for select to authenticated using (public.can_access_scope(owner_id,organization_id,office_id,share_scope) and (deleted_at is null or owner_id=auth.uid() or public.can_manage_office(office_id)));
create policy flyers_insert on public.flyers for insert to authenticated with check (
  owner_id=auth.uid() and organization_id=public.current_org_id()
  and exists(select 1 from public.offices o where o.id=office_id and o.organization_id=public.current_org_id() and o.is_active)
  and exists(select 1 from public.profiles p where p.id=assignee_id and p.organization_id=public.current_org_id() and p.is_active)
);
-- Shared flyers are editable by employees who can access them. version prevents silent overwrites.
create policy flyers_update on public.flyers for update to authenticated using (public.can_access_scope(owner_id,organization_id,office_id,share_scope)) with check (
  organization_id=public.current_org_id()
  and exists(select 1 from public.offices o where o.id=office_id and o.organization_id=public.current_org_id() and o.is_active)
  and exists(select 1 from public.profiles p where p.id=assignee_id and p.organization_id=public.current_org_id() and p.is_active)
);
create policy flyers_delete on public.flyers for delete to authenticated using (
  deleted_at <= now()-interval '30 days' and public.can_access_scope(owner_id,organization_id,office_id,share_scope) and (owner_id=auth.uid() or public.can_manage_office(office_id))
);

create policy templates_select on public.templates for select to authenticated using (public.can_access_scope(owner_id,organization_id,coalesce(office_id,public.current_office_id()),share_scope));
create policy templates_insert on public.templates for insert to authenticated with check (
  owner_id=auth.uid() and organization_id=public.current_org_id() and (
    share_scope='private' or (share_scope='office' and office_id=public.current_office_id()) or share_scope='company'
  )
);
create policy templates_update on public.templates for update to authenticated using (
  owner_id=auth.uid() or (share_scope='office' and public.can_manage_office(office_id)) or (share_scope='company' and public.current_app_role()='org_admin')
) with check (organization_id=public.current_org_id());
create policy templates_delete on public.templates for delete to authenticated using (
  owner_id=auth.uid() or (share_scope='office' and public.can_manage_office(office_id)) or (share_scope='company' and public.current_app_role()='org_admin')
);

-- A photo can be fetched when its own library scope allows access, or when an
-- accessible flyer references it. This keeps the photo library private while
-- still allowing a shared flyer to render its attached private photo.
create or replace function public.can_access_media(
  p_media_id uuid,
  p_owner uuid,
  p_org uuid,
  p_office uuid,
  p_scope public.share_scope
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.can_access_scope(p_owner,p_org,p_office,p_scope)
    or exists(
      select 1
      from public.flyers f
      where f.deleted_at is null
        and public.can_access_scope(f.owner_id,f.organization_id,f.office_id,f.share_scope)
        and exists(
          select 1
          from jsonb_array_elements(coalesce(f.editor_state->'items','[]'::jsonb)) as item
          where item->'media'->>'mediaId'=p_media_id::text
        )
    )
$$;
revoke all on function public.can_access_media(uuid,uuid,uuid,uuid,public.share_scope) from public;
grant execute on function public.can_access_media(uuid,uuid,uuid,uuid,public.share_scope) to authenticated;

create policy media_select on public.media for select to authenticated using (public.can_access_media(id,owner_id,organization_id,office_id,share_scope));
create policy media_insert on public.media for insert to authenticated with check (
  owner_id=auth.uid() and organization_id=public.current_org_id() and office_id=public.current_office_id()
);
create policy media_update on public.media for update to authenticated using (
  owner_id=auth.uid() or (share_scope='office' and public.can_manage_office(office_id)) or (share_scope='company' and public.current_app_role()='org_admin')
) with check (organization_id=public.current_org_id());
create policy media_delete on public.media for delete to authenticated using (
  public.can_access_scope(owner_id,organization_id,office_id,share_scope) and (owner_id=auth.uid() or public.can_manage_office(office_id))
);

create policy audit_select on public.audit_logs for select to authenticated using (
  organization_id=public.current_org_id() and public.current_app_role()='org_admin'
);

-- Prevent owner/org tampering on shared rows through direct REST PATCHes.
create or replace function public.protect_flyer_identity()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.organization_id<>old.organization_id or new.owner_id<>old.owner_id or new.created_at<>old.created_at then
    raise exception 'immutable flyer identity';
  end if;
  return new;
end $$;
create or replace trigger flyers_identity_guard before update on public.flyers for each row execute function public.protect_flyer_identity();

create or replace function public.update_flyer_versioned(
  p_flyer_id uuid,
  p_expected_version integer,
  p_title text,
  p_category_id uuid,
  p_office_id uuid,
  p_assignee_id uuid,
  p_share_scope text,
  p_orientation text,
  p_layout_count smallint,
  p_design_style text,
  p_main_color text,
  p_editor_state jsonb
)
returns setof public.flyers
language plpgsql
security definer
set search_path=public
as $$
begin
  return query
    update public.flyers
      set title=p_title,
          category_id=p_category_id,
          office_id=case when owner_id=auth.uid() or public.can_manage_office(office_id) then p_office_id else office_id end,
          assignee_id=case when owner_id=auth.uid() or public.can_manage_office(office_id) then p_assignee_id else assignee_id end,
          share_scope=case when owner_id=auth.uid() or public.can_manage_office(office_id) then p_share_scope::public.share_scope else share_scope end,
          orientation=p_orientation::public.page_orientation,
          layout_count=p_layout_count,
          design_style=p_design_style::public.design_style,
          main_color=p_main_color,
          editor_state=p_editor_state,
          version=version+1,
          updated_at=now()
    where id=p_flyer_id and version=p_expected_version and deleted_at is null
      and public.can_access_scope(owner_id,organization_id,office_id,share_scope)
      and exists(select 1 from public.offices o where o.id=p_office_id and o.organization_id=public.current_org_id() and o.is_active)
      and exists(select 1 from public.profiles p where p.id=p_assignee_id and p.organization_id=public.current_org_id() and p.is_active)
      and exists(select 1 from public.categories c where c.id=p_category_id and (c.organization_id is null or c.organization_id=public.current_org_id()) and c.is_active)
    returning *;
end $$;
revoke all on function public.update_flyer_versioned(uuid,integer,text,uuid,uuid,uuid,text,text,smallint,text,text,jsonb) from public;
grant execute on function public.update_flyer_versioned(uuid,integer,text,uuid,uuid,uuid,text,text,smallint,text,text,jsonb) to authenticated;

create or replace function public.set_flyer_deleted(p_flyer_id uuid,p_deleted boolean)
returns setof public.flyers
language plpgsql
security definer
set search_path=public
as $$
begin
  return query update public.flyers
    set deleted_at=case when p_deleted then now() else null end, updated_at=now()
    where id=p_flyer_id
      and public.can_access_scope(owner_id,organization_id,office_id,share_scope)
      and (owner_id=auth.uid() or public.can_manage_office(office_id))
    returning *;
end $$;
revoke all on function public.set_flyer_deleted(uuid,boolean) from public;
grant execute on function public.set_flyer_deleted(uuid,boolean) to authenticated;

-- Authenticated browser role gets table access; RLS remains authoritative.
grant select,insert,update,delete on public.organizations,public.offices,public.profiles,public.categories,public.design_presets,public.templates,public.media to authenticated;
grant select,insert,delete on public.flyers to authenticated;
grant select on public.audit_logs to authenticated;

-- Private storage bucket. No public URL is created.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('flyer-media','flyer-media',false,20971520,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.can_access_media_object(p_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select exists(
    select 1 from public.media m
    where (m.original_path=p_name or m.preview_path=p_name)
      and m.deleted_at is null
      and public.can_access_media(m.id,m.owner_id,m.organization_id,m.office_id,m.share_scope)
  )
$$;
revoke all on function public.can_access_media_object(text) from public;
grant execute on function public.can_access_media_object(text) to authenticated;

create policy flyer_media_insert on storage.objects for insert to authenticated with check (
  bucket_id='flyer-media' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy flyer_media_select on storage.objects for select to authenticated using (
  bucket_id='flyer-media' and public.can_access_media_object(name)
);
create policy flyer_media_delete on storage.objects for delete to authenticated using (
  bucket_id='flyer-media' and (storage.foldername(name))[1]=auth.uid()::text
);

-- Single-organization starter data for 太陽シルバーサービス.
-- Office contact values are seeded from the company's public branch list.
insert into public.organizations(id,name,address,phone,fax)
values('00000000-0000-4000-8000-000000000001','太陽シルバーサービス株式会社','福岡県朝倉郡筑前町高田585番地1','0946-21-4700','0946-21-4701')
on conflict (id) do update set name=excluded.name,address=excluded.address,phone=excluded.phone,fax=excluded.fax;

insert into public.offices(id,organization_id,name,address,phone,fax,is_active) values
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','行橋営業所','福岡県行橋市大字流末1327','0930-26-9640','0930-26-9641',true),
('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','小倉営業所','福岡県北九州市小倉北区重住3丁目11-21','093-952-1616','093-952-1627',true),
('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','小倉南営業所','福岡県北九州市小倉南区田原新町1丁目3-34','093-474-5670','093-474-5671',true),
('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','八幡西営業所','福岡県北九州市八幡西区本城東2丁目4-8','093-603-3512','093-601-3593',true),
('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','八幡東営業所','福岡県北九州市八幡東区山路松尾町14-6','093-654-8515','093-654-8516',true),
('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','田川営業所','福岡県田川市川宮1200','0947-44-1895','0947-44-2372',true),
('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','飯塚営業所','福岡県飯塚市枝国510番地7','0948-52-6360','0948-52-6362',true),
('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','福岡南営業所','福岡県大野城市御笠川2丁目10-15','092-504-9810','092-504-9811',true),
('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','福岡西営業所','福岡県福岡市早良区小田部4丁目11-31','092-833-0131','092-833-0132',true),
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','福岡東営業所','福岡県福岡市東区松田3丁目25-2','092-627-1150','092-627-1151',true),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','久留米営業所','福岡県小郡市小郡97-19','0942-72-8822','0942-72-8833',true),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','大牟田営業所','福岡県大牟田市大字歴木446-1','0944-59-1488','0944-59-1481',true),
('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001','佐賀営業所','佐賀県佐賀市鍋島5丁目4-15','0952-34-1224','0952-34-1225',true),
('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000001','長崎営業所','長崎県長崎市界2-2-4','095-834-0535','095-834-0536',true),
('00000000-0000-4000-8000-000000000016','00000000-0000-4000-8000-000000000001','大村営業所','長崎県大村市溝陸町643-1','0957-49-6222','0957-49-6333',true),
('00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000001','壱岐営業所','長崎県壱岐市郷ノ浦町田中触1078','0920-47-9005','0920-47-9006',true),
('00000000-0000-4000-8000-000000000018','00000000-0000-4000-8000-000000000001','熊本営業所','熊本県熊本市東区画図町大字下無田1432-22','096-377-7630','096-377-7631',true),
('00000000-0000-4000-8000-000000000019','00000000-0000-4000-8000-000000000001','熊本北営業所','熊本県熊本市北区鶴羽田1丁目10番7号','096-341-5765','096-341-5766',true),
('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000001','大分営業所','大分県大分市下郡東1-4-35','097-504-8001','097-504-8002',true)
on conflict (id) do update set name=excluded.name,address=excluded.address,phone=excluded.phone,fax=excluded.fax,is_active=true;

insert into public.categories(organization_id,name,slug,sort_order) values
(null,'事例集','casebook',10),(null,'レンタル','rental',20),(null,'住宅改修','renovation',30),
(null,'特定福祉用具','specific-welfare',40),(null,'自費レンタル','private-rental',50),(null,'商品チラシ','product-flyer',60)
on conflict do nothing;

insert into public.design_presets(organization_id,name,style,settings,sort_order) values
(null,'標準','standard','{"font":"serif","density":"normal"}',10),
(null,'シンプル','simple','{"font":"sans","density":"normal"}',20),
(null,'やわらかい','soft','{"font":"serif","radius":"soft"}',30),
(null,'商品紹介','product','{"font":"sans","priceEmphasis":true}',40)
on conflict do nothing;

-- Private company assets (logo). Accessible only inside the organization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-assets','company-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy company_assets_select on storage.objects for select to authenticated using (
  bucket_id='company-assets' and (storage.foldername(name))[1]=public.current_org_id()::text
);
create policy company_assets_insert on storage.objects for insert to authenticated with check (
  bucket_id='company-assets' and (storage.foldername(name))[1]=public.current_org_id()::text and public.current_app_role()='org_admin'
);
create policy company_assets_update on storage.objects for update to authenticated using (
  bucket_id='company-assets' and (storage.foldername(name))[1]=public.current_org_id()::text and public.current_app_role()='org_admin'
) with check (
  bucket_id='company-assets' and (storage.foldername(name))[1]=public.current_org_id()::text and public.current_app_role()='org_admin'
);
create policy company_assets_delete on storage.objects for delete to authenticated using (
  bucket_id='company-assets' and (storage.foldername(name))[1]=public.current_org_id()::text and public.current_app_role()='org_admin'
);
