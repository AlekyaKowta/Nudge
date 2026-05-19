import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TimetableView from '@/components/timetable/TimetableView'

export default async function TimetablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('start_time', { ascending: true })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Timetable</h1>
        <p className="text-gray-500 mt-1">Plan your weekly schedule.</p>
      </div>
      <TimetableView initialEntries={entries ?? []} userId={user.id} />
    </div>
  )
}
