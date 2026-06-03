'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Group, Friendship, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Users2, Check, LogIn } from 'lucide-react'
import Link from 'next/link'

type PopulatedGroup = Group & {
  admin: Profile
  members: { user_id: string }[]
}

type PopulatedFriendship = Friendship & {
  requester: Profile
  addressee: Profile
}

function getFriend(f: PopulatedFriendship, currentUserId: string): Profile {
  return f.requester_id === currentUserId ? f.addressee : f.requester
}

function memberCount(g: PopulatedGroup) {
  return g.members?.length ?? 0
}

export default function GroupsList({
  initialGroups,
  friendships,
  currentUserId,
}: {
  initialGroups: PopulatedGroup[]
  friendships: PopulatedFriendship[]
  currentUserId: string
}) {
  const [groups, setGroups] = useState<PopulatedGroup[]>(initialGroups)
  const [incompleteByGroup, setIncompleteByGroup] = useState<Record<string, number>>({})
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const localToday = new Date().toLocaleDateString('en-CA')
    const myGroupIds = groups
      .filter(g => g.members.some(m => m.user_id === currentUserId))
      .map(g => g.id)
    if (myGroupIds.length === 0) return

    async function fetchCounts() {
      const [{ data: todayTasks }, { data: myCompletions }] = await Promise.all([
        supabase.from('group_tasks').select('id, group_id').in('group_id', myGroupIds).eq('task_date', localToday),
        supabase.from('group_task_completions').select('task_id').eq('user_id', currentUserId),
      ])
      const completedIds = new Set((myCompletions ?? []).map(c => c.task_id))
      const counts: Record<string, number> = {}
      for (const task of (todayTasks ?? [])) {
        if (!completedIds.has(task.id)) {
          counts[task.group_id] = (counts[task.group_id] ?? 0) + 1
        }
      }
      setIncompleteByGroup(counts)
    }
    fetchCounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  const friends = friendships.map(f => getFriend(f, currentUserId))
  const myGroups = groups.filter(g => g.members.some(m => m.user_id === currentUserId))
  const otherGroups = groups.filter(g => !g.members.some(m => m.user_id === currentUserId))

  function toggleFriend(id: string) {
    setSelectedFriendIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: name.trim(), admin_id: currentUserId })
      .select('*, admin:profiles!admin_id(*)')
      .single()

    if (error || !group) {
      toast.error('Failed to create group')
      setLoading(false)
      return
    }

    const memberRows = [currentUserId, ...selectedFriendIds].map(uid => ({
      group_id: group.id,
      user_id: uid,
    }))
    await supabase.from('group_members').insert(memberRows)

    const newGroup: PopulatedGroup = {
      ...group,
      members: memberRows.map(r => ({ user_id: r.user_id })),
    }
    setGroups(prev => [newGroup, ...prev])
    setName('')
    setSelectedFriendIds([])
    setOpen(false)
    toast.success('Group created!')
    setLoading(false)
  }

  async function joinGroup(groupId: string) {
    setJoiningId(groupId)
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: currentUserId })

    if (error) {
      toast.error('Failed to join group')
      setJoiningId(null)
      return
    }

    setGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, members: [...g.members, { user_id: currentUserId }] } as PopulatedGroup
          : g
      )
    )
    toast.success('Joined group!')
    setJoiningId(null)
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700" />}>
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a group</DialogTitle>
            </DialogHeader>
            <form onSubmit={createGroup} className="space-y-4">
              <div className="space-y-2">
                <Label>Group name</Label>
                <Input
                  placeholder="e.g. LeetCoding Crew, Morning Run..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              {friends.length > 0 && (
                <div className="space-y-2">
                  <Label>Add friends (optional)</Label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {friends.map(friend => {
                      const selected = selectedFriendIds.includes(friend.id)
                      const initials = friend.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => toggleFriend(friend.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                            selected
                              ? 'border-indigo-300 bg-indigo-50'
                              : 'border-gray-100 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={friend.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm font-medium text-gray-800">{friend.full_name}</span>
                          {selected && <Check className="h-4 w-4 text-indigo-600" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? 'Creating...' : 'Create group'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {myGroups.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">My Groups</h2>
          <div className="grid gap-3">
            {myGroups.map(g => (
              <GroupCard key={g.id} group={g} isAdmin={g.admin_id === currentUserId} incompleteTasks={incompleteByGroup[g.id] ?? 0}>
                <Link href={`/groups/${g.id}`}>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">View</Button>
                </Link>
              </GroupCard>
            ))}
          </div>
        </section>
      )}

      {otherGroups.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Other Groups</h2>
          <div className="grid gap-3">
            {otherGroups.map(g => (
              <GroupCard key={g.id} group={g} isAdmin={false}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => joinGroup(g.id)}
                  disabled={joiningId === g.id}
                >
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  {joiningId === g.id ? 'Joining...' : 'Join'}
                </Button>
              </GroupCard>
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Users2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No groups yet</p>
          <p className="text-sm mt-1">Create one to start holding each other accountable.</p>
        </div>
      )}
    </div>
  )
}

function GroupCard({
  group,
  isAdmin,
  incompleteTasks = 0,
  children,
}: {
  group: PopulatedGroup
  isAdmin: boolean
  incompleteTasks?: number
  children: React.ReactNode
}) {
  const count = memberCount(group)
  const adminInitials = group.admin.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
        <Users2 className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
          {isAdmin && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">Admin</span>
          )}
          {incompleteTasks > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
              {incompleteTasks} task{incompleteTasks > 1 ? 's' : ''} today
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Avatar className="h-4 w-4">
            <AvatarImage src={group.admin.avatar_url ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[8px]">{adminInitials}</AvatarFallback>
          </Avatar>
          <p className="text-xs text-gray-500">
            by {group.admin.full_name} · {count} {count === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
