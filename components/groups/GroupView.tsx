'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group, GroupMember, GroupTaskWithCompletions, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeft, ChevronLeft, ChevronRight, Bell, Trash2, Plus, Check, CalendarPlus } from 'lucide-react'
import Link from 'next/link'

type PopulatedGroup = Group & { admin: Profile }
type PopulatedMember = GroupMember & { profile: Profile }

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function initials(profile: Profile) {
  return profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'
}

export default function GroupView({
  group,
  members,
  initialTasks,
  initialDate,
  currentUserId,
}: {
  group: PopulatedGroup
  members: PopulatedMember[]
  initialTasks: GroupTaskWithCompletions[]
  initialDate: string
  currentUserId: string
}) {
  // Use client's local date to avoid UTC server timezone mismatch
  const clientToday = typeof window !== 'undefined'
    ? new Date().toLocaleDateString('en-CA')
    : initialDate

  const [tasks, setTasks] = useState<GroupTaskWithCompletions[]>(initialTasks)
  const [currentDate, setCurrentDate] = useState(initialDate)

  useEffect(() => {
    if (currentDate !== clientToday) {
      loadDate(clientToday)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [nudgeTarget, setNudgeTarget] = useState<{ taskTitle: string; member: Profile } | null>(null)
  const [nudgeMessage, setNudgeMessage] = useState('')
  const [nudgeSending, setNudgeSending] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isAdmin = group.admin_id === currentUserId

  const taskSelect = '*, completions:group_task_completions(*, profile:profiles!user_id(*)), postponements:group_task_postponements(user_id, postponed_to, profile:profiles!user_id(*))'

  async function loadDate(date: string) {
    const [{ data: regularData }, { data: postponedIds }] = await Promise.all([
      supabase
        .from('group_tasks')
        .select(taskSelect)
        .eq('group_id', group.id)
        .eq('task_date', date)
        .order('created_at', { ascending: true }),
      supabase
        .from('group_task_postponements')
        .select('task_id')
        .eq('postponed_to', date),
    ])

    const postponedTaskIds = (postponedIds ?? []).map((p: { task_id: string }) => p.task_id)
    let postponedTasks: GroupTaskWithCompletions[] = []
    if (postponedTaskIds.length > 0) {
      const { data } = await supabase
        .from('group_tasks')
        .select(taskSelect)
        .in('id', postponedTaskIds)
        .eq('group_id', group.id)
        .neq('task_date', date)
      postponedTasks = (data ?? []) as unknown as GroupTaskWithCompletions[]
    }

    const regular = (regularData ?? []) as unknown as GroupTaskWithCompletions[]
    const filtered = regular.filter(task => {
      const mine = task.postponements?.find(p => p.user_id === currentUserId)
      return !mine || mine.postponed_to === date
    })
    const existingIds = new Set(filtered.map(t => t.id))
    setTasks([...filtered, ...postponedTasks.filter(t => !existingIds.has(t.id))])
    setCurrentDate(date)
  }

  async function postponeTask(task: GroupTaskWithCompletions) {
    const nextDay = shiftDate(currentDate, 1)
    const { error } = await supabase
      .from('group_task_postponements')
      .upsert(
        { task_id: task.id, user_id: currentUserId, postponed_to: nextDay },
        { onConflict: 'task_id,user_id' }
      )
    if (error) { toast.error('Failed to postpone'); return }
    setTasks(prev => prev.filter(t => t.id !== task.id))
    toast.success('Moved to tomorrow')
  }

  async function toggleCompletion(task: GroupTaskWithCompletions) {
    const myCompletion = task.completions.find(c => c.user_id === currentUserId)

    if (myCompletion) {
      await supabase.from('group_task_completions').delete().eq('id', myCompletion.id)
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, completions: t.completions.filter(c => c.id !== myCompletion.id) as GroupTaskWithCompletions['completions'] }
          : t
      ))
    } else {
      const myProfile = members.find(m => m.user_id === currentUserId)?.profile
      if (!myProfile) return
      const { data, error } = await supabase
        .from('group_task_completions')
        .insert({ task_id: task.id, user_id: currentUserId })
        .select('*, profile:profiles!user_id(*)')
        .single()
      if (error) { toast.error('Failed to update'); return }
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, completions: [...t.completions, data as GroupTaskWithCompletions['completions'][number]] }
          : t
      ))
      await fetch('/api/streak', { method: 'POST' })
    }
    router.refresh()
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setAddingTask(true)

    const { data, error } = await supabase
      .from('group_tasks')
      .insert({ group_id: group.id, created_by: currentUserId, title: newTaskTitle.trim(), task_date: currentDate })
      .select(taskSelect)
      .single()

    if (error || !data) { toast.error('Failed to add task'); setAddingTask(false); return }
    setTasks(prev => [...prev, data as GroupTaskWithCompletions])

    const otherMembers = members.filter(m => m.user_id !== currentUserId)
    if (otherMembers.length > 0) {
      await supabase.from('reminders').insert(
        otherMembers.map(m => ({
          sender_id: currentUserId,
          receiver_id: m.user_id,
          todo_id: null,
          message: `New task in ${group.name}: "${newTaskTitle.trim()}"`,
        }))
      )
    }

    setNewTaskTitle('')
    setAddingTask(false)
  }

  async function deleteTask(taskId: string) {
    const { error } = await supabase.from('group_tasks').delete().eq('id', taskId)
    if (error) { toast.error('Failed to delete task'); return }
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function sendNudge() {
    if (!nudgeTarget) return
    setNudgeSending(true)

    const { error } = await supabase.from('reminders').insert({
      sender_id: currentUserId,
      receiver_id: nudgeTarget.member.id,
      todo_id: null,
      message: nudgeMessage.trim()
        ? nudgeMessage.trim()
        : `Hey! Don't forget to complete "${nudgeTarget.taskTitle}" in ${group.name} 👊`,
    })

    setNudgeSending(false)
    if (error) { toast.error('Failed to send nudge'); return }
    toast.success(`Nudged ${nudgeTarget.member.full_name}!`)
    setNudgeTarget(null)
    setNudgeMessage('')
  }

  const myCompletedCount = tasks.filter(t => t.completions.some(c => c.user_id === currentUserId)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/groups" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{group.name}</h1>
          <p className="text-xs text-gray-500">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        </div>
      </div>

      {/* Member strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {members.map(m => (
          <div key={m.id} className="flex flex-col items-center gap-1 shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={m.profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{initials(m.profile)}</AvatarFallback>
            </Avatar>
            <span className={`text-[10px] max-w-[52px] truncate text-center font-medium ${m.user_id === currentUserId ? 'text-indigo-500' : 'text-gray-400'}`}>
              {m.user_id === currentUserId ? 'You' : m.profile.full_name?.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
        <button
          onClick={() => loadDate(shiftDate(currentDate, -1))}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">{formatDate(currentDate)}</p>
          {tasks.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{myCompletedCount}/{tasks.length} done</p>
          )}
        </div>
        <button
          onClick={() => loadDate(shiftDate(currentDate, 1))}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">{isAdmin ? 'No tasks yet — add one below.' : 'No tasks for this day.'}</p>
          </div>
        )}

        {tasks.map(task => {
          const myDone = task.completions.some(c => c.user_id === currentUserId)
          return (
            <div key={task.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleCompletion(task)}
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                    myDone ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {myDone && <Check className="h-2.5 w-2.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${myDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  {task.postponements && task.postponements.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {task.postponements.map(p => (
                        <span key={p.user_id} className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <CalendarPlus className="h-2.5 w-2.5" />
                          {p.profile?.full_name?.split(' ')[0] ?? 'Someone'} postponed
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!myDone && (
                  <button
                    onClick={() => postponeTask(task)}
                    className="p-1 rounded text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    title="Move to tomorrow"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Per-member completion row */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {members.map(m => {
                  const done = task.completions.some(c => c.user_id === m.user_id)
                  const isMe = m.user_id === currentUserId
                  return (
                    <button
                      key={m.id}
                      disabled={isMe}
                      onClick={() => {
                        if (!isMe && !done) {
                          setNudgeTarget({ taskTitle: task.title, member: m.profile })
                          setNudgeMessage('')
                        }
                      }}
                      title={done ? `${m.user_id === currentUserId ? 'You' : m.profile.full_name} completed` : `Nudge ${m.profile.full_name}`}
                      className={`relative group flex items-center gap-1 ${!isMe && !done ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <Avatar className={`h-6 w-6 ring-2 ${done ? 'ring-green-400' : 'ring-gray-200'}`}>
                        <AvatarImage src={m.profile.avatar_url ?? undefined} />
                        <AvatarFallback className={`text-[9px] ${done ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {initials(m.profile)}
                        </AvatarFallback>
                      </Avatar>
                      {!isMe && !done && (
                        <Bell className="h-3 w-3 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add task (admin only) */}
      {isAdmin && (
        <form onSubmit={addTask} className="flex gap-2">
          <Input
            placeholder="Add a task for this day..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={addingTask || !newTaskTitle.trim()} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Nudge dialog */}
      <Dialog open={!!nudgeTarget} onOpenChange={open => { if (!open) setNudgeTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a nudge</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-600">
              Nudging <span className="font-medium">{nudgeTarget?.member.full_name}</span> about:
            </p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium">
              {nudgeTarget?.taskTitle}
            </div>
            <Textarea
              placeholder="Add a message... (optional)"
              value={nudgeMessage}
              onChange={e => setNudgeMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={sendNudge}
              disabled={nudgeSending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              {nudgeSending ? 'Sending...' : 'Send nudge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
