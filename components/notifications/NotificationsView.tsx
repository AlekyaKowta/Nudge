'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Reminder, Profile, Todo } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type PopulatedReminder = Reminder & { sender: Profile; todo: Todo | null }

export default function NotificationsView({
  initialReminders,
  userId,
}: {
  initialReminders: PopulatedReminder[]
  userId: string
}) {
  const [reminders, setReminders] = useState<PopulatedReminder[]>(initialReminders)
  const supabase = createClient()

  async function markRead(id: string) {
    await supabase.from('reminders').update({ read: true }).eq('id', id)
    setReminders(prev => prev.map(r => r.id === id ? { ...r, read: true } : r))
  }

  async function markAllRead() {
    const unreadIds = reminders.filter(r => !r.read).map(r => r.id)
    if (unreadIds.length === 0) return
    await supabase.from('reminders').update({ read: true }).in('id', unreadIds)
    setReminders(prev => prev.map(r => ({ ...r, read: true })))
    toast.success('All marked as read')
  }

  function getInitials(profile: Profile) {
    return profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'
  }

  const unreadCount = reminders.filter(r => !r.read).length

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{unreadCount} unread</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-indigo-600 hover:text-indigo-700">
            Mark all as read
          </Button>
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BellOff className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-600">No notifications yet</p>
          <p className="text-sm mt-1">Your friends&apos; kudos and reminders will show up here.</p>
        </div>
      ) : (
        reminders.map(reminder => (
          <div
            key={reminder.id}
            className={`bg-white rounded-xl border p-4 shadow-sm flex items-start gap-3 transition-all ${
              !reminder.read ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'
            }`}
          >
            <Avatar className="h-9 w-9 mt-0.5">
              <AvatarImage src={reminder.sender.avatar_url ?? undefined} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(reminder.sender)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{reminder.sender.full_name}</span>
                  {reminder.message && (
                    <p className="text-sm text-gray-600 mt-0.5">{reminder.message}</p>
                  )}
                  {reminder.todo && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="truncate">{reminder.todo.title}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(reminder.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!reminder.read && (
                  <button
                    onClick={() => markRead(reminder.id)}
                    className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Mark as read"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {!reminder.read && (
              <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
            )}
          </div>
        ))
      )}
    </div>
  )
}
