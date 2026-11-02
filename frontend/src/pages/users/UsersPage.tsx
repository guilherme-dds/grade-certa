import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { UserForm } from './UserForm'

export function UsersPage() {
  const [created, setCreated] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Crie a conta de quem vai usar o sistema. Todos os usuários têm o mesmo acesso."
      />

      <div className="max-w-md rounded-lg border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold">Novo usuário</h2>
        {created && (
          <p role="status" className="mb-4 rounded-md border border-primary-soft-line bg-primary-soft px-3 py-2 text-[13px]">
            Conta de {created} criada. Passe o e-mail e a senha para a pessoa entrar.
          </p>
        )}
        <UserForm submitLabel="Criar usuário" pendingLabel="Criando…" onCreated={(user) => setCreated(user.email)} />
      </div>
    </>
  )
}
