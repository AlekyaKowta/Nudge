'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  Users,
  Bell,
  LogOut,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Feed', icon: LayoutDashboard },
  { href: '/todos', label: 'My Todos', icon: ListTodo },
  { href: '/timetable', label: 'Timetable', icon: Calendar },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?'

  return (
    <aside className="w-64 flex flex-col bg-white border-r border-gray-200 h-full">
      <div className="p-6 border-b border-gray-100">
        <img src="/logo.png" alt="Nudge" className="h-10 w-auto" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        {profile && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <div className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-xs text-gray-500">{profile.streak ?? 0} day streak</span>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
