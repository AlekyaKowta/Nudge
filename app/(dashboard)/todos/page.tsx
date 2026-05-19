import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TodoList from '@/components/todos/TodoList'

export default async function TodosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Todos</h1>
        <p className="text-gray-500 mt-1">Track your tasks and share your progress.</p>
      </div>
      <TodoList initialTodos={todos ?? []} userId={user.id} />
    </div>
  )
}
