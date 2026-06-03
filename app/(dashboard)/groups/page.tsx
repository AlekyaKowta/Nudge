import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupsList from '@/components/groups/GroupsList'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
      />
    </div>
  )
}
