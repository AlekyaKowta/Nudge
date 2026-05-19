'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Todo } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeft, Bell, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function FriendBoardView({
  friend,
  initialTodos,
  currentUserId,
}: {
  friend: Profile
  initialTodos: Todo[]
  currentUserId: string
}) {
  const [remindTarget, setRemindTarget] = useState<Todo | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  const initials = friend.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'
  const incomplete = initialTodos.filter(t => !t.completed)
  const complete = initialTodos.filter(t => t.completed)

  async function sendReminder() {
    if (!remindTarget) return
    setSending(true)

    const { error } = await supabase.from('reminders').insert({
      sender_id: currentUserId,
      receiver_id: friend.id,
      todo_id: remindTarget.id,
      message: message.trim() || null,
    })

    setSending(false)

    if (error) {
      toast.error('Failed to send reminder')
      return
    }

    toast.success(`Reminder sent to ${friend.full_name}!`)
    setRemindTarget(null)
    setMessage('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/friends" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar className="h-10 w-10">
          <AvatarImage src={friend.avatar_url ?? undefined} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{friend.full_name}</h1>
          <p className="text-sm text-gray-500">@{friend.username}</p>
        </div>
      </div>

      {initialTodos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium text-gray-600">Nothing shared yet</p>
          <p className="text-sm mt-1">{friend.full_name} hasn&apos;t shared any tasks.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {incomplete.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pending · {incomplete.length}
              </h2>
              <div className="space-y-2">
                {incomplete.map(todo => (
                  <div key={todo.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
                    <Circle className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{todo.title}</p>
                      {todo.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{todo.description}</p>
                      )}
                      {todo.due_date && (
                        <p className="text-xs text-gray-400 mt-1">Due {todo.due_date}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setRemindTarget(todo); setMessage('') }}
                      className="shrink-0 p-1.5 rounded-md text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Send reminder"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {complete.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Completed · {complete.length}
              </h2>
              <div className="space-y-2">
                {complete.map(todo => (
                  <div key={todo.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3 opacity-60">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-500 line-through">{todo.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={!!remindTarget} onOpenChange={open => { if (!open) setRemindTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-600">
              Reminding <span className="font-medium">{friend.full_name}</span> about:
            </p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium">
              {remindTarget?.title}
            </div>
            <Textarea
              placeholder="Add a message... (optional)"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={sendReminder}
              disabled={sending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              {sending ? 'Sending...' : 'Send reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
