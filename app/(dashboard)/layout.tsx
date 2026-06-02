import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: profile }, { count: unreadCount }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('read', false),
    supabase.from('group_members').select('group_id').eq('user_id', user.id),
  ])

  const groupIds = (memberships ?? []).map((m: { group_id: string }) => m.group_id)
  let incompleteGroupTasks = 0
  if (groupIds.length > 0) {
    const { data: done } = await supabase
      .from('group_task_completions')
      .select('task_id')
      .eq('user_id', user.id)
    const doneIds = (done ?? []).map((c: { task_id: string }) => c.task_id)

    let q = supabase
      .from('group_tasks')
      .select('*', { count: 'exact', head: true })
      .in('group_id', groupIds)
      .eq('task_date', today)
    if (doneIds.length > 0) {
      q = q.not('id', 'in', `(${doneIds.join(',')})`)
    }
    const { count } = await q
    incompleteGroupTasks = count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} unreadCount={unreadCount ?? 0} incompleteGroupTasks={incompleteGroupTasks} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
