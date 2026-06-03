import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GroupView from '@/components/groups/GroupView'
import { GroupTaskWithCompletions } from '@/types/database'

export default async function GroupPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id: groupId } = await params
  const { date: dateParam } = await searchParams
  // Fall back to UTC today only when a date is explicitly provided via URL.
  // When no date param exists, GroupView will use the client's local date instead.
  const selectedDate = dateParam ?? new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) notFound()

  const taskSelect = '*, completions:group_task_completions(*, profile:profiles!user_id(*)), postponements:group_task_postponements(user_id, postponed_to, profile:profiles!user_id(*))'

  const [{ data: group }, { data: members }, { data: tasks }, { data: postponedIds }] = await Promise.all([
    supabase
      .from('groups')
      .select('*, admin:profiles!admin_id(*)')
      .eq('id', groupId)
      .single(),
    supabase
      .from('group_members')
      .select('*, profile:profiles!user_id(*)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('group_tasks')
      .select(taskSelect)
      .eq('group_id', groupId)
      .eq('task_date', selectedDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('group_task_postponements')
      .select('task_id')
      .eq('postponed_to', selectedDate),
  ])

  if (!group) notFound()

  // Fetch tasks postponed to this date from other dates
  const postponedTaskIds = (postponedIds ?? []).map((p: { task_id: string }) => p.task_id)
  let postponedTasks: GroupTaskWithCompletions[] = []
  if (postponedTaskIds.length > 0) {
    const { data } = await supabase
      .from('group_tasks')
      .select(taskSelect)
      .in('id', postponedTaskIds)
      .eq('group_id', groupId)
      .neq('task_date', selectedDate)
    postponedTasks = (data ?? []) as unknown as GroupTaskWithCompletions[]
  }

  // Merge: filter out tasks current user has postponed away, add in postponed-to-today tasks
  const regular = (tasks ?? []) as unknown as GroupTaskWithCompletions[]
  const filtered = regular.filter(task => {
    const mine = task.postponements?.find(p => p.user_id === user.id)
    return !mine || mine.postponed_to === selectedDate
  })
  const existingIds = new Set(filtered.map(t => t.id))
  const mergedTasks = [...filtered, ...postponedTasks.filter(t => !existingIds.has(t.id))]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <GroupView
        group={group}
        members={members ?? []}
        initialTasks={mergedTasks}
        initialDate={selectedDate}
        currentUserId={user.id}
      />
    </div>
  )
}
