import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedItem from '@/components/feed/FeedItem'
import { Flame, Users, Trophy, Star } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get accepted friend IDs
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')

  const friendIds = (friendships ?? []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )

  // Get shared completed todos from friends (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: feedItems } = friendIds.length > 0
    ? await supabase
        .from('todos')
        .select('*, profile:profiles!user_id(*)')
        .in('user_id', friendIds)
        .eq('completed', true)
        .eq('is_shared', true)
        .gte('completed_at', sevenDaysAgo)
        .order('completed_at', { ascending: false })
        .limit(50)
    : { data: [] }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}!
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what your friends have been up to.</p>
      </div>

      {profile && (() => {
        const points = profile.points ?? 0
        const isPrizeDay = points > 0 && points % 1000 === 0
        const progress = isPrizeDay ? 100 : (points % 1000) / 10

        if (isPrizeDay) {
          return (
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-5 mb-8 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-lg p-2">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">Prize Day! {points.toLocaleString()} points</p>
                  <p className="text-yellow-100 text-sm">You hit a milestone — time to celebrate!</p>
                </div>
                <Star className="h-5 w-5 text-white/70" />
              </div>
            </div>
          )
        }

        return (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 mb-8 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 rounded-lg p-2">
                <Flame className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">{profile.streak ?? 0}-day streak</p>
                <p className="text-indigo-100 text-sm">Keep completing tasks to maintain it!</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">{points.toLocaleString()}</p>
                <p className="text-indigo-100 text-xs">points</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-indigo-200 mb-1">
                <span>{points % 1000} / 1000 to next Prize Day</span>
                <span>{Math.floor(points / 1000) > 0 ? `${Math.floor(points / 1000)} milestone${Math.floor(points / 1000) > 1 ? 's' : ''} reached` : ''}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/70 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {feedItems && feedItems.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Friends&apos; Activity</h2>
          {feedItems.map(item => (
            <FeedItem key={item.id} item={item} currentUserId={user.id} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-600">No activity yet</p>
          <p className="text-sm mt-1">
            {friendIds.length === 0
              ? 'Add some friends to see their progress here.'
              : "Your friends haven't completed any shared tasks recently."}
          </p>
        </div>
      )}
    </div>
  )
}
