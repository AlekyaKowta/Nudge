'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Todo, Profile } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type FeedTodo = Todo & { profile: Profile }

export default function FeedItem({ item, currentUserId }: { item: FeedTodo; currentUserId: string }) {
  const [reminded, setReminded] = useState(false)
  const initials = item.profile.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'

  async function sendReminder() {
    const supabase = createClient()
    const { error } = await supabase.from('reminders').insert({
      sender_id: currentUserId,
      receiver_id: item.user_id,
      todo_id: item.id,
      message: `Keep it up! Saw you completed "${item.title}" 🎉`,
    })
    if (error) {
      toast.error('Could not send reminder')
      return
    }
    setReminded(true)
    toast.success('Kudos sent!')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 mt-0.5">
          <AvatarImage src={item.profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{item.profile.full_name}</span>
            <span className="text-gray-400 text-xs">@{item.profile.username}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-sm text-gray-700 truncate">{item.title}</p>
          </div>
          {item.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {item.completed_at
                ? formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })
                : ''}
            </span>
            <div className="flex items-center gap-2">
              {item.due_date && (
                <Badge variant="secondary" className="text-xs">
                  Due {item.due_date}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                onClick={sendReminder}
                disabled={reminded}
              >
                <Bell className="h-3 w-3 mr-1" />
                {reminded ? 'Kudos sent!' : 'Send kudos'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
