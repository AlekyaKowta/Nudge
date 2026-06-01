'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Friendship, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { UserPlus, Check, X, UserX, Search, LayoutList } from 'lucide-react'
import Link from 'next/link'

type PopulatedFriendship = Friendship & { requester: Profile; addressee: Profile }

export default function FriendsView({
  initialFriendships,
  currentUserId,
  allUsers,
}: {
  initialFriendships: PopulatedFriendship[]
  currentUserId: string
  allUsers: Profile[]
}) {
  const [friendships, setFriendships] = useState<PopulatedFriendship[]>(initialFriendships)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const supabase = createClient()

  const accepted = friendships.filter(f => f.status === 'accepted')
  const incoming = friendships.filter(f => f.status === 'pending' && f.addressee_id === currentUserId)
  const outgoing = friendships.filter(f => f.status === 'pending' && f.requester_id === currentUserId)

  async function searchUsers() {
    if (!searchQuery.trim()) return
    setSearching(true)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', currentUserId)
      .limit(10)

    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function sendRequest(addresseeId: string) {
    const alreadyExists = friendships.some(
      f => (f.requester_id === currentUserId && f.addressee_id === addresseeId) ||
           (f.addressee_id === currentUserId && f.requester_id === addresseeId)
    )
    if (alreadyExists) { toast.info('Request already exists'); return }

    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: currentUserId, addressee_id: addresseeId })
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .single()

    if (error) { toast.error('Failed to send request'); return }

    setFriendships(prev => [...prev, data as PopulatedFriendship])
    setSearchResults(prev => prev.filter(p => p.id !== addresseeId))
    toast.success('Friend request sent!')
  }

  async function respondToRequest(friendshipId: string, accept: boolean) {
    const status = accept ? 'accepted' : 'declined'
    const { error } = await supabase.from('friendships').update({ status }).eq('id', friendshipId)
    if (error) { toast.error('Failed to respond'); return }

    if (accept) {
      setFriendships(prev => prev.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f))
      toast.success('Friend request accepted!')
    } else {
      setFriendships(prev => prev.filter(f => f.id !== friendshipId))
      toast.info('Request declined')
    }
  }

  async function removeFriend(friendshipId: string) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) { toast.error('Failed to remove friend'); return }
    setFriendships(prev => prev.filter(f => f.id !== friendshipId))
    toast.success('Friend removed')
  }

  function getFriendProfile(f: PopulatedFriendship): Profile {
    return f.requester_id === currentUserId ? f.addressee : f.requester
  }

  function getInitials(profile: Profile) {
    return profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'
  }

  const suggestions = allUsers.filter(u =>
    !friendships.some(
      f => f.requester_id === u.id || f.addressee_id === u.id
    )
  )

  return (
    <div className="space-y-6">
      {/* People on Nudge */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-gray-700">People on Nudge</p>
          <div className="space-y-1">
            {suggestions.map(profile => (
              <div key={profile.id} className="flex items-center gap-3 py-2 border-t border-gray-50 first:border-t-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(profile)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile.full_name}</p>
                  <p className="text-xs text-gray-500">@{profile.username}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(profile.id)} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs shrink-0">
                  <UserPlus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium text-gray-700">Find friends by username</p>
        <div className="flex gap-2">
          <Input
            placeholder="Search username..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
          />
          <Button onClick={searchUsers} disabled={searching} variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 mt-2">
            {searchResults.map(profile => {
              const existing = friendships.find(
                f => (f.requester_id === currentUserId && f.addressee_id === profile.id) ||
                     (f.addressee_id === currentUserId && f.requester_id === profile.id)
              )
              return (
                <div key={profile.id} className="flex items-center gap-3 py-2 border-t border-gray-50">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(profile)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-gray-500">@{profile.username}</p>
                  </div>
                  {existing ? (
                    <Badge variant="secondary" className="text-xs">
                      {existing.status === 'accepted' ? 'Friends' : 'Pending'}
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => sendRequest(profile.id)} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs">
                      <UserPlus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {searchResults.length === 0 && searchQuery && !searching && (
          <p className="text-sm text-gray-400 mt-2">No users found.</p>
        )}
      </div>

      <Tabs defaultValue="friends">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            Friends {accepted.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{accepted.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="incoming">
            Requests {incoming.length > 0 && <Badge className="ml-1.5 text-xs bg-indigo-600">{incoming.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-2 mt-4">
          {accepted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No friends yet. Search for someone above!</p>
          ) : accepted.map(f => {
            const friend = getFriendProfile(f)
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={friend.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(friend)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{friend.full_name}</p>
                  <p className="text-xs text-gray-500">@{friend.username}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/friends/${friend.id}`}
                    className="p-1.5 rounded-md text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="View board"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => removeFriend(f.id)}
                    className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove friend"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="incoming" className="space-y-2 mt-4">
          {incoming.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pending requests.</p>
          ) : incoming.map(f => {
            const requester = f.requester
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={requester.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(requester)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{requester.full_name}</p>
                  <p className="text-xs text-gray-500">@{requester.username}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => respondToRequest(f.id, true)} className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondToRequest(f.id, false)} className="h-7 w-7 p-0 border-gray-200 hover:border-red-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2 mt-4">
          {outgoing.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No outgoing requests.</p>
          ) : outgoing.map(f => {
            const addressee = f.addressee
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={addressee.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(addressee)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{addressee.full_name}</p>
                  <p className="text-xs text-gray-500">@{addressee.username}</p>
                </div>
                <Badge variant="secondary" className="text-xs">Pending</Badge>
              </div>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}
