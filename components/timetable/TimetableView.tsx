'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TimetableEntry } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, Clock } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

export default function TimetableView({ initialEntries, userId }: { initialEntries: TimetableEntry[]; userId: string }) {
  const [entries, setEntries] = useState<TimetableEntry[]>(initialEntries)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<string>('1')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (endTime <= startTime) {
      toast.error('End time must be after start time')
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('timetable_entries')
      .insert({ user_id: userId, title, day_of_week: parseInt(day), start_time: startTime, end_time: endTime, color })
      .select()
      .single()

    if (error) { toast.error('Failed to add entry'); setLoading(false); return }

    setEntries(prev => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setTitle(''); setDay('1'); setStartTime('09:00'); setEndTime('10:00'); setColor(COLORS[0])
    setOpen(false)
    toast.success('Entry added!')
    setLoading(false)
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setEntries(prev => prev.filter(e => e.id !== id))
    toast.success('Entry removed')
  }

  const today = new Date().getDay()

  return (
    <div className="space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700" />}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add timetable entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={addEntry} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Morning workout, Study session..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={day} onValueChange={(v) => v && setDay(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#1f2937' : 'transparent',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Adding...' : 'Add entry'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((dayName, dayIndex) => {
          const dayEntries = entries.filter(e => e.day_of_week === dayIndex)
          const isToday = dayIndex === today

          return (
            <div key={dayIndex} className={`rounded-xl border ${isToday ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white'} p-3 min-h-[200px]`}>
              <div className="mb-2">
                <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-700' : 'text-gray-500'}`}>
                  {dayName.slice(0, 3)}
                </p>
                {isToday && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />}
              </div>

              <div className="space-y-1.5">
                {dayEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="rounded-md p-1.5 text-white text-xs group relative"
                    style={{ backgroundColor: entry.color }}
                  >
                    <p className="font-medium leading-tight truncate">{entry.title}</p>
                    <div className="flex items-center gap-0.5 mt-0.5 opacity-80">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{entry.start_time.slice(0, 5)}-{entry.end_time.slice(0, 5)}</span>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}

                {dayEntries.length === 0 && (
                  <p className="text-xs text-gray-300 mt-2">Empty</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
