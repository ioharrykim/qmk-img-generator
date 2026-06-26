-- 마케팅챕터 이미지 스튜디오 — Supabase 스키마 (팀 모드)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

-- ── 1) 생성 기록 테이블 ─────────────────────────────
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text,
  size text,
  quality text,
  format text,
  model text,
  n int,
  ref_count int default 0,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- 이미 배포된 테이블이 있다면(비용 추산 기능 추가 시) 아래 한 줄만 실행:
alter table public.generations add column if not exists quality text;

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

-- 본인 기록만 읽기/추가/삭제 (개인별 비공개)
drop policy if exists "gen select own" on public.generations;
create policy "gen select own" on public.generations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "gen insert own" on public.generations;
create policy "gen insert own" on public.generations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "gen delete own" on public.generations;
create policy "gen delete own" on public.generations
  for delete to authenticated using (auth.uid() = user_id);

-- ── 2) Storage 버킷 (비공개) ────────────────────────
insert into storage.buckets (id, name, public)
  values ('generations', 'generations', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('uploads', 'uploads', false)
  on conflict (id) do nothing;

-- ── 3) Storage 정책 — 본인 폴더(={user_id}/...)만 ───
-- 생성 결과: 함수가 service role 로 업로드하므로, 클라이언트는 본인 것 읽기/삭제만 필요
drop policy if exists "gen objects select own" on storage.objects;
create policy "gen objects select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gen objects delete own" on storage.objects;
create policy "gen objects delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);

-- 참조 업로드: 클라이언트가 직접 올리고/읽고/지움
drop policy if exists "uploads objects all own" on storage.objects;
create policy "uploads objects all own" on storage.objects
  for all to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
