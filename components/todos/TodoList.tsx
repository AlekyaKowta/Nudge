'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Todo } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, Globe, Lock, CalendarDays } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function TodoList({ initialTodos, userId }: { initialTodos: Todo[]; userId: string }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        is_shared: isShared,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add todo')
      setLoading(false)
      return
    }

    setTodos(prev => [data, ...prev])
    setTitle('')
    setDescription('')
    setDueDate('')
    setIsShared(false)
    setOpen(false)
    toast.success('Todo added!')
    setLoading(false)
  }

  async function toggleTodo(todo: Todo) {
    const completed = !todo.completed
    const completedAt = completed ? new Date().toISOString() : null

    const { error } = await supabase
      .from('todos')
      .update({ completed, completed_at: completedAt })
      .eq('id', todo.id)

    if (error) {
      toast.error('Failed to update todo')
      return
    }

    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed, completed_at: completedAt } : t))

    if (completed) {
      toast.success('Task completed! 🎉')
      // Update streak server-side via a small fetch
      await fetch('/api/streak', { method: 'POST' })
    }
  }

  async function deleteTodo(id: string) {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) { toast.error('Failed to delete todo'); return }
    setTodos(prev => prev.filter(t => t.id !== id))
    toast.success('Todo deleted')
  }

  async function toggleShared(todo: Todo) {
    const isShared = !todo.is_shared
    const { error } = await supabase.from('todos').update({ is_shared: isShared }).eq('id', todo.id)
    if (error) { toast.error('Failed to update'); return }
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_shared: isShared } : t))
    toast.success(isShared ? 'Now visible to friends' : 'Hidden from friends')
  }

  const pending = todos.filter(t => !t.completed)
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000)
  const completed = todos.filter(t => t.completed && t.completed_at && new Date(t.completed_at) > cutoff)

  return (
    <div className="space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700" />}>
          <Plus className="h-4 w-4 mr-2" />
          Add Todo
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new todo</DialogTitle>
          </DialogHeader>
          <form onSubmit={addTodo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="What do you need to do?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                placeholder="Add more details..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Due date (optional)</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="shared"
                checked={isShared}
                onCheckedChange={v => setIsShared(v === true)}
              />
              <Label htmlFor="shared" className="cursor-pointer">
                Share completion with friends
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Adding...' : 'Add todo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Pending ({pending.length})
          </h2>
          {pending.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onToggleShared={toggleShared}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Completed ({completed.length})
          </h2>
          {completed.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onToggleShared={toggleShared}
            />
          ))}
        </div>
      )}

      {todos.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium text-gray-600">No todos yet</p>
          <p className="text-sm mt-1">Add your first task to get started!</p>
        </div>
      )}
    </div>
  )
}

function TodoCard({
  todo,
  onToggle,
  onDelete,
  onToggleShared,
}: {
  todo: Todo
  onToggle: (t: Todo) => void
  onDelete: (id: string) => void
  onToggleShared: (t: Todo) => void
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3 ${todo.completed ? 'opacity-70' : ''}`}>
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => onToggle(todo)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {todo.due_date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <CalendarDays className="h-3 w-3" />
              Due {todo.due_date}
            </span>
          )}
          {todo.completed_at && (
            <span className="text-xs text-green-600">
              Completed {formatDistanceToNow(new Date(todo.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleShared(todo)}
          title={todo.is_shared ? 'Visible to friends' : 'Only you can see this'}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          {todo.is_shared
            ? <Globe className="h-4 w-4 text-indigo-500" />
            : <Lock className="h-4 w-4 text-gray-300" />
          }
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="p-1.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
