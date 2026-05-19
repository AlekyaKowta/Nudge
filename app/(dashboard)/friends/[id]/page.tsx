import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import FriendBoardView from '@/components/friends/FriendBoardView'

export default async function FriendBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: friendId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify they are actually friends
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(addressee_id.eq.${user.id},requester_id.eq.${friendId})`
    )
    .single()

  if (!friendship) notFound()

  const [{ data: friendProfile }, { data: todos }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', friendId).single(),
    supabase
      .from('todos')
      .select('*')
      .eq('user_id', friendId)
      .eq('is_shared', true)
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  if (!friendProfile) notFound()

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <FriendBoardView
        friend={friendProfile}
        initialTodos={todos ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
