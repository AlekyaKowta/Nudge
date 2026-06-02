-- Run this in your Supabase SQL editor to set up the database.

-- PROFILES (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  streak int default 0,
  points int default 0,
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

-- ============================================================
-- SHARED ACCOUNTABILITY GROUPS
-- ============================================================

create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  admin_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

create table public.group_tasks (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  task_date date not null default current_date,
  created_at timestamptz default now()
);

create table public.group_task_completions (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.group_tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  completed_at timestamptz default now(),
  unique(task_id, user_id)
);

create table public.group_task_postponements (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.group_tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  postponed_to date not null,
  created_at timestamptz default now(),
  unique(task_id, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_tasks enable row level security;
alter table public.group_task_completions enable row level security;
alter table public.group_task_postponements enable row level security;

create policy "Authenticated users can view all groups"
  on public.groups for select using (auth.uid() is not null);
create policy "Users can create groups"
  on public.groups for insert with check (auth.uid() = admin_id);
create policy "Admin can update group"
  on public.groups for update using (auth.uid() = admin_id);
create policy "Admin can delete group"
  on public.groups for delete using (auth.uid() = admin_id);

create policy "Authenticated users can view group membership"
  on public.group_members for select using (auth.uid() is not null);
create policy "Users can join groups or admin can add members"
  on public.group_members for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.groups where id = group_id and admin_id = auth.uid())
  );
create policy "Admin or self can remove members"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.groups where id = group_id and admin_id = auth.uid())
  );

create policy "Group members can view tasks"
  on public.group_tasks for select
  using (exists (select 1 from public.group_members where group_id = group_tasks.group_id and user_id = auth.uid()));
create policy "Admin can create group tasks"
  on public.group_tasks for insert
  with check (
    auth.uid() = created_by
    and exists (select 1 from public.groups where id = group_id and admin_id = auth.uid())
  );
create policy "Admin can delete group tasks"
  on public.group_tasks for delete
  using (exists (select 1 from public.groups where id = group_id and admin_id = auth.uid()));

create policy "Group members can view completions"
  on public.group_task_completions for select
  using (
    exists (
      select 1 from public.group_members gm
      join public.group_tasks gt on gt.id = task_id
      where gm.group_id = gt.group_id and gm.user_id = auth.uid()
    )
  );
create policy "Members can insert own completion"
  on public.group_task_completions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_members gm
      join public.group_tasks gt on gt.id = task_id
      where gm.group_id = gt.group_id and gm.user_id = auth.uid()
    )
  );
create policy "Members can delete own completion"
  on public.group_task_completions for delete using (auth.uid() = user_id);

create policy "Group members can view postponements"
  on public.group_task_postponements for select
  using (
    exists (
      select 1 from public.group_members gm
      join public.group_tasks gt on gt.id = task_id
      where gm.group_id = gt.group_id and gm.user_id = auth.uid()
    )
  );
create policy "Members can insert own postponement"
  on public.group_task_postponements for insert
  with check (auth.uid() = user_id);
create policy "Members can update own postponement"
  on public.group_task_postponements for update using (auth.uid() = user_id);
create policy "Members can delete own postponement"
  on public.group_task_postponements for delete using (auth.uid() = user_id);

drop policy "Users can send reminders to friends" on public.reminders;
create policy "Users can send reminders to friends or group members"
  on public.reminders for insert
  with check (
    auth.uid() = sender_id and (
      exists (
        select 1 from public.friendships
        where status = 'accepted'
        and ((requester_id = auth.uid() and addressee_id = receiver_id)
             or (addressee_id = auth.uid() and requester_id = receiver_id))
      )
      or exists (
        select 1 from public.group_members gm1
        join public.group_members gm2 on gm1.group_id = gm2.group_id
        where gm1.user_id = auth.uid() and gm2.user_id = receiver_id
      )
    )
  );
