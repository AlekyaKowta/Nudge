import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GroupView from '@/components/groups/GroupView'

export default async function GroupPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id: groupId } = await params
  const { date: dateParam } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const selectedDate = dateParam ?? today

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

  const [{ data: group }, { data: members }, { data: tasks }] = await Promise.all([
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
      .select('*, completions:group_task_completions(*, profile:profiles!user_id(*))')
      .eq('group_id', groupId)
      .eq('task_date', selectedDate)
      .order('created_at', { ascending: true }),
  ])

  if (!group) notFound()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <GroupView
        group={group}
        members={members ?? []}
        initialTasks={tasks ?? []}
        initialDate={selectedDate}
        currentUserId={user.id}
      />
    </div>
  )
}
