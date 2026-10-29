-- 001_init_schema — theo docs/db-design.md
-- Chạy bằng Supabase MCP apply_migration (name: init_schema). Không dùng prisma migrate.

-- ============ Extensions ============
create extension if not exists pg_trgm with schema extensions;

-- ============ Enums ============
create type public.user_role as enum ('READER', 'LIBRARIAN', 'ADMIN');
create type public.loan_status as enum ('PENDING', 'BORROWING', 'OVERDUE', 'RETURNED', 'REJECTED');
create type public.return_request_status as enum ('PENDING', 'CONFIRMED');
create type public.book_condition as enum ('NORMAL', 'DAMAGED', 'LOST');
create type public.fine_reason as enum ('LATE', 'DAMAGED', 'LOST');
create type public.fine_status as enum ('UNPAID', 'PENDING', 'REJECTED', 'PAID');

-- ============ Functions ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============ users ============
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         varchar(255) not null unique,
  password_hash varchar(255) not null,
  name          varchar(50)  not null,
  phone         varchar(15),
  address       varchar(255),
  role          public.user_role not null default 'READER',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_users_email_lower check (email = lower(email)),
  constraint chk_users_name_not_blank check (length(trim(name)) > 0)
);
create index idx_users_role_active on public.users (role, is_active);
create index idx_users_name_trgm on public.users using gin (name extensions.gin_trgm_ops);
create index idx_users_email_trgm on public.users using gin (email extensions.gin_trgm_ops);

-- ============ categories ============
create table public.categories (
  id         integer generated always as identity primary key,
  name       varchar(50) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_categories_name_not_blank check (length(trim(name)) > 0)
);
create unique index uq_categories_name_lower on public.categories (lower(name));

-- ============ books ============
create table public.books (
  id                 uuid primary key default gen_random_uuid(),
  title              varchar(100) not null,
  author             varchar(100) not null,
  publish_year       smallint not null,
  isbn               varchar(13),
  category_id        integer references public.categories (id) on delete set null,
  description        varchar(255) not null,
  total_quantity     integer not null,
  available_quantity integer not null default 0,
  borrowed_quantity  integer not null default 0,
  damaged_quantity   integer not null default 0,
  lost_quantity      integer not null default 0,
  borrow_count       integer not null default 0,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_books_publish_year check (publish_year >= 1900),
  constraint chk_books_isbn_format check (isbn ~ '^(\d{9}[\dX]|\d{13})$'),
  constraint chk_books_total_positive check (total_quantity > 0),
  constraint chk_books_counters_non_negative check (
    available_quantity >= 0 and borrowed_quantity >= 0 and damaged_quantity >= 0
    and lost_quantity >= 0 and borrow_count >= 0
  ),
  constraint chk_books_quantity_balance check (
    total_quantity = available_quantity + borrowed_quantity + damaged_quantity + lost_quantity
  )
);
create unique index uq_books_isbn_active on public.books (isbn)
  where deleted_at is null and isbn is not null;
create index idx_books_category_active on public.books (category_id) where deleted_at is null;
create index idx_books_title_trgm on public.books using gin (title extensions.gin_trgm_ops);
create index idx_books_author_trgm on public.books using gin (author extensions.gin_trgm_ops);
create index idx_books_borrow_count on public.books (borrow_count desc) where deleted_at is null;

-- R-03: không xóa thể loại khi còn sách chưa xóa mềm
create or replace function public.block_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.books b where b.category_id = old.id and b.deleted_at is null
  ) then
    raise exception 'CATEGORY_HAS_BOOKS' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger trg_categories_block_delete
  before delete on public.categories
  for each row execute function public.block_category_delete();

-- ============ loans ============
create table public.loans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete restrict,
  book_id          uuid not null references public.books (id) on delete restrict,
  status           public.loan_status not null default 'PENDING',
  duration_days    smallint not null default 14,
  requested_at     timestamptz not null default now(),
  borrow_date      date,
  due_date         date,
  extension_count  smallint not null default 0,
  extended_at      timestamptz,
  confirmed_by     uuid references public.users (id),
  confirmed_at     timestamptz,
  reject_reason    varchar(255),
  rejected_by      uuid references public.users (id),
  rejected_at      timestamptz,
  returned_at      timestamptz,
  return_condition public.book_condition,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chk_loans_duration check (duration_days between 1 and 30),
  constraint chk_loans_extension check (extension_count between 0 and 1),
  constraint chk_loans_dates check (
    status in ('PENDING', 'REJECTED') or (borrow_date is not null and due_date is not null)
  ),
  constraint chk_loans_rejected check (status <> 'REJECTED' or reject_reason is not null),
  constraint chk_loans_returned check (
    status <> 'RETURNED' or (returned_at is not null and return_condition is not null)
  )
);
create index idx_loans_user_status on public.loans (user_id, status);
create index idx_loans_book_status on public.loans (book_id, status);
create index idx_loans_status_due on public.loans (status, due_date);
create unique index uq_loans_user_book_active on public.loans (user_id, book_id)
  where status in ('PENDING', 'BORROWING', 'OVERDUE');
create index idx_loans_requested_at on public.loans (requested_at);
create index idx_loans_borrow_date on public.loans (borrow_date);
create index idx_loans_returned_at on public.loans (returned_at);
create index idx_loans_confirmed_by on public.loans (confirmed_by);
create index idx_loans_rejected_by on public.loans (rejected_by);

-- ============ return_requests ============
create table public.return_requests (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references public.loans (id) on delete restrict,
  status       public.return_request_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  condition    public.book_condition,
  note         varchar(500),
  confirmed_by uuid references public.users (id),
  confirmed_at timestamptz,
  constraint chk_rr_confirmed check (
    status <> 'CONFIRMED' or (condition is not null and confirmed_at is not null)
  ),
  constraint chk_rr_note check (condition not in ('DAMAGED', 'LOST') or note is not null)
);
create unique index uq_rr_loan_pending on public.return_requests (loan_id) where status = 'PENDING';
create index idx_rr_loan on public.return_requests (loan_id);
create index idx_rr_status_requested on public.return_requests (status, requested_at);
create index idx_rr_confirmed_damaged_lost on public.return_requests (confirmed_at)
  where condition in ('DAMAGED', 'LOST');
create index idx_rr_confirmed_by on public.return_requests (confirmed_by);

-- ============ fine_levels ============
create table public.fine_levels (
  id           integer generated always as identity primary key,
  name         varchar(25) not null,
  amount       numeric(12, 0) not null,
  applied_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint chk_fine_levels_amount check (amount > 0)
);
create unique index uq_fine_levels_name_lower on public.fine_levels (lower(name));

-- ============ fines ============
create table public.fines (
  id                   uuid primary key default gen_random_uuid(),
  seq                  bigint generated always as identity unique,
  code                 varchar(10) generated always as ('F' || lpad(seq::text, 6, '0')) stored unique,
  user_id              uuid not null references public.users (id) on delete restrict,
  loan_id              uuid not null references public.loans (id) on delete restrict,
  return_request_id    uuid not null references public.return_requests (id),
  reason               public.fine_reason not null,
  fine_level_id        integer references public.fine_levels (id) on delete set null,
  fine_level_name      varchar(25) not null,
  amount               numeric(12, 0) not null,
  note                 varchar(500),
  fine_date            date not null,
  status               public.fine_status not null default 'UNPAID',
  payment_note         varchar(255),
  payment_requested_at timestamptz,
  reject_reason        varchar(255),
  rejected_at          timestamptz,
  paid_at              timestamptz,
  confirmed_by         uuid references public.users (id),
  created_by           uuid not null references public.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint chk_fines_amount check (amount > 0),
  constraint uq_fines_loan_reason unique (loan_id, reason),
  constraint chk_fines_paid check (status <> 'PAID' or paid_at is not null),
  constraint chk_fines_rejected check (status <> 'REJECTED' or reject_reason is not null)
);
create index idx_fines_user_status on public.fines (user_id, status);
create index idx_fines_status_created on public.fines (status, created_at);
create index idx_fines_paid_at on public.fines (paid_at) where status = 'PAID';
create index idx_fines_return_request on public.fines (return_request_id);
create index idx_fines_fine_level on public.fines (fine_level_id);
create index idx_fines_confirmed_by on public.fines (confirmed_by);
create index idx_fines_created_by on public.fines (created_by);
-- fines.loan_id đã được phủ bởi uq_fines_loan_reason (cột đầu)

-- ============ updated_at triggers ============
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_books_updated_at before update on public.books
  for each row execute function public.set_updated_at();
create trigger trg_loans_updated_at before update on public.loans
  for each row execute function public.set_updated_at();
create trigger trg_fine_levels_updated_at before update on public.fine_levels
  for each row execute function public.set_updated_at();
create trigger trg_fines_updated_at before update on public.fines
  for each row execute function public.set_updated_at();

-- ============ Overdue refresh ============
create or replace function public.refresh_overdue_loans()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.loans
     set status = 'OVERDUE'
   where status = 'BORROWING'
     and due_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ============ RLS: bật trên mọi bảng, không tạo policy ============
-- Backend kết nối bằng role postgres (bỏ qua RLS); anon/authenticated qua PostgREST bị chặn hoàn toàn.
alter table public.users           enable row level security;
alter table public.categories      enable row level security;
alter table public.books           enable row level security;
alter table public.loans           enable row level security;
alter table public.return_requests enable row level security;
alter table public.fine_levels     enable row level security;
alter table public.fines           enable row level security;

revoke execute on function public.refresh_overdue_loans() from public, anon, authenticated;
