import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FriendsView from '@/components/friends/FriendsView'

export default async function FriendsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: friendships }, { data: allUsers }] = await Promise.all([
    supabase
      .from('friendships')
      .select('*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .order('full_name'),
  ])

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <p className="text-gray-500 mt-1">Connect with others and nudge each other forward.</p>
      </div>
      <FriendsView initialFriendships={friendships ?? []} currentUserId={user.id} allUsers={allUsers ?? []} />
    </div>
  )
}
