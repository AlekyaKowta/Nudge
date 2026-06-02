import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupsList from '@/components/groups/GroupsList'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: groups }, { data: friendships }] = await Promise.all([
    supabase
      .from('groups')
      .select('*, admin:profiles!admin_id(*), members:group_members(user_id)')
      .order('created_at', { ascending: false }),
    supabase
      .from('friendships')
      .select('*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted'),
  ])

  const myGroupIds = (groups ?? [])
    .filter(g => g.members.some((m: { user_id: string }) => m.user_id === user.id))
    .map(g => g.id)

  const incompleteByGroup: Record<string, number> = {}
  if (myGroupIds.length > 0) {
    const [{ data: todayTasks }, { data: myCompletions }] = await Promise.all([
      supabase.from('group_tasks').select('id, group_id').in('group_id', myGroupIds).eq('task_date', today),
      supabase.from('group_task_completions').select('task_id').eq('user_id', user.id),
    ])
    const completedIds = new Set((myCompletions ?? []).map((c: { task_id: string }) => c.task_id))
    for (const task of (todayTasks ?? [])) {
      if (!completedIds.has(task.id)) {
        incompleteByGroup[task.group_id] = (incompleteByGroup[task.group_id] ?? 0) + 1
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="text-gray-500 mt-1">Create groups with friends and hold each other accountable.</p>
      </div>
      <GroupsList
        initialGroups={groups ?? []}
        friendships={friendships ?? []}
        currentUserId={user.id}
        incompleteByGroup={incompleteByGroup}
      />
    </div>
  )
}
