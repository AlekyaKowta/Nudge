import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotificationsView from '@/components/notifications/NotificationsView'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, sender:profiles!sender_id(*), todo:todos(*)')
    .eq('receiver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">Kudos and reminders from your friends.</p>
      </div>
      <NotificationsView initialReminders={reminders ?? []} userId={user.id} />
    </div>
  )
}
