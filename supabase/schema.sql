-- Run this in your Supabase SQL editor to set up the database.

-- PROFILES (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  streak int default 0,
  last_activity_date date,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- FRIENDSHIPS
create table public.friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- TODOS
create table public.todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date,
  completed boolean default false,
  completed_at timestamptz,
  is_shared boolean default false,
  created_at timestamptz default now()
);

-- TIMETABLE ENTRIES
create table public.timetable_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  day_of_week int check (day_of_week between 0 and 6) not null,
  start_time time not null,
  end_time time not null,
  color text default '#6366f1',
  created_at timestamptz default now()
);

-- REMINDERS (kudos/nudges between friends)
create table public.reminders (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  todo_id uuid references public.todos(id) on delete set null,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.todos enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.reminders enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Friendships policies
create policy "Users can view friendships they are part of"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can create friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can update (accept/decline)"
  on public.friendships for update
  using (auth.uid() = addressee_id);

create policy "Users can delete their own friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Todos policies
create policy "Users can view their own todos"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "Friends can view shared todos"
  on public.todos for select
  using (
    is_shared = true and
    exists (
      select 1 from public.friendships
      where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = user_id)
           or (addressee_id = auth.uid() and requester_id = user_id))
    )
  );

create policy "Users can insert their own todos"
  on public.todos for insert with check (auth.uid() = user_id);

create policy "Users can update their own todos"
  on public.todos for update using (auth.uid() = user_id);

create policy "Users can delete their own todos"
  on public.todos for delete using (auth.uid() = user_id);

-- Timetable policies
create policy "Users can manage their timetable"
  on public.timetable_entries for all using (auth.uid() = user_id);

-- Reminders policies
create policy "Users can view reminders sent to them"
  on public.reminders for select
  using (auth.uid() = receiver_id);

create policy "Users can send reminders to friends"
  on public.reminders for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.friendships
      where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = receiver_id)
           or (addressee_id = auth.uid() and requester_id = receiver_id))
    )
  );

create policy "Users can update their own reminders (mark read)"
  on public.reminders for update using (auth.uid() = receiver_id);
