import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak, last_activity_date')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ ok: true })

  if (profile.last_activity_date === today) {
    return NextResponse.json({ ok: true })
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const newStreak = profile.last_activity_date === yesterday ? (profile.streak ?? 0) + 1 : 1

  await supabase
    .from('profiles')
    .update({ streak: newStreak, last_activity_date: today })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, streak: newStreak })
}
