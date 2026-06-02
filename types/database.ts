export type Profile = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  streak: number
  points: number
  last_activity_date: string | null
  created_at: string
}

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  requester?: Profile
  addressee?: Profile
}

export type Todo = {
  id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  is_shared: boolean
  created_at: string
  profile?: Profile
}

export type TimetableEntry = {
  id: string
  user_id: string
  title: string
  day_of_week: number
  start_time: string
  end_time: string
  color: string
  created_at: string
}

export type Reminder = {
  id: string
  sender_id: string
  receiver_id: string
  todo_id: string | null
  message: string | null
  read: boolean
  created_at: string
  sender?: Profile
  todo?: Todo
}

export type FeedItem = {
  id: string
  user_id: string
  todo_id: string
  completed_at: string
  profile: Profile
  todo: Todo
}

export type Group = {
  id: string
  name: string
  admin_id: string
  created_at: string
  admin?: Profile
  members?: GroupMember[]
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export type GroupTaskPostponement = {
  user_id: string
  postponed_to: string
  profile?: Profile
}

export type GroupTask = {
  id: string
  group_id: string
  created_by: string
  title: string
  task_date: string
  created_at: string
  completions?: GroupTaskCompletion[]
  postponements?: GroupTaskPostponement[]
}

export type GroupTaskCompletion = {
  id: string
  task_id: string
  user_id: string
  completed_at: string
  profile?: Profile
}

export type GroupTaskWithCompletions = GroupTask & {
  completions: (GroupTaskCompletion & { profile: Profile })[]
  postponements: GroupTaskPostponement[]
}
