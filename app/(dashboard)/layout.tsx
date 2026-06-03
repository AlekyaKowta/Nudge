import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('read', false),
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} unreadCount={unreadCount ?? 0} currentUserId={user.id} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
