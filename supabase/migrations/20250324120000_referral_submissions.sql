-- Tabelle: Mitarbeiter-Empfehlungen (öffentliches Formular -> INSERT nur als anon)
create table if not exists public.referral_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  candidate_name text not null,
  phone text not null,
  email text,
  qualification text,
  nps_score integer
    constraint referral_submissions_nps_score_range check (
      nps_score is null
      or (nps_score >= 0 and nps_score <= 10)
    ),
  feedback text,
  referral_code text
);

comment on table public.referral_submissions is 'Empfehlungen aus dem öffentlichen Formular; Lesen/Löschen nur über Edge Function (Service Role).';

alter table public.referral_submissions enable row level security;

-- Öffentlich: nur neue Zeilen anlegen
drop policy if exists "referral_submissions_insert_anon" on public.referral_submissions;
create policy "referral_submissions_insert_anon"
  on public.referral_submissions
  for insert
  to anon
  with check (true);

-- optional: authentifizierte Nutzer:innen ebenfalls nur INSERT (falls du später Auth nutzt)
drop policy if exists "referral_submissions_insert_authenticated" on public.referral_submissions;
create policy "referral_submissions_insert_authenticated"
  on public.referral_submissions
  for insert
  to authenticated
  with check (true);

-- Keine SELECT/UPDATE/DELETE-Policies -> anon/authenticated haben keinen direkten Tabellenzugriff
-- Service Role (Edge Functions) umgeht RLS.

create index if not exists referral_submissions_created_at_idx
  on public.referral_submissions (created_at desc);
