-- Allow calendar events to sync.
--
-- The app stores calendar events as notes with kind 'event' (lib/notes.ts,
-- created from MonthlyChart). The original notes CHECK constraint only allowed
-- ('daily','monthly','custom'), so every push that included an event row was
-- rejected by Postgres — and because the sync layer batched the upsert and the
-- delete together, that rejection also stranded unrelated note DELETEs (a
-- deleted sticky note kept reappearing on the next pull). The sync layer now
-- issues upsert/delete independently; this widens the constraint so events sync
-- too.
--
-- Apply against the live project in the Supabase SQL editor.

alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check
  check (kind in ('daily', 'monthly', 'custom', 'event'));
