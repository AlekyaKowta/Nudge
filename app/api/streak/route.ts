import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak, points, last_activity_date')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ ok: true })

  const newPoints = (profile.points ?? 0) + 1

  // Always award a point
  const update: Record<string, unknown> = { points: newPoints }

  // Only update streak once per day
  if (profile.last_activity_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    update.streak = profile.last_activity_date === yesterday ? (profile.streak ?? 0) + 1 : 1
    update.last_activity_date = today
  }

  await supabase.from('profiles').update(update).eq('id', user.id)

  return NextResponse.json({ ok: true, points: newPoints, streak: update.streak ?? profile.streak })
}
