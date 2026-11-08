import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteUser, getUsers, setUserActive } from '@/api/users'
import type { User } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/schedule'
import { UserForm } from './UserForm'

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [created, setCreated] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const usersQuery = useQuery({ queryKey: ['usuarios'], queryFn: getUsers })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] })
  const onError = (err: unknown) => setError(getApiErrorMessage(err, 'Não foi possível alterar o usuário.'))

  const toggleActive = useMutation({
    mutationFn: (u: User) => setUserActive(u.id, !u.is_active),
    onSuccess: refresh,
    onError,
  })
  const remove = useMutation({
    mutationFn: (u: User) => deleteUser(u.id),
    onSuccess: () => {
      setConfirmingDelete(null)
      return refresh()
    },
    onError,
  })
  const busy = toggleActive.isPending || remove.isPending

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas de quem usa o sistema. Todos os usuários têm o mesmo acesso; ninguém desativa ou exclui a própria conta."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          {error && (
            <p role="alert" className="border-b border-line px-4 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          )}
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-paper text-muted">
                <th className="px-4 py-2.5 font-semibold">Nome</th>
                <th className="px-4 py-2.5 font-semibold">E-mail</th>
                <th className="px-4 py-2.5 font-semibold">Situação</th>
                <th className="px-4 py-2.5 font-semibold">Criado em</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data ?? []).map((u) => {
                const isMe = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {u.name}
                      {isMe && <span className="ml-1.5 text-[11px] font-normal text-muted">(você)</span>}
                    </td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className={`px-4 py-2.5 ${u.is_active ? 'text-ink' : 'text-muted'}`}>
                      {u.is_active ? 'Ativo' : 'Desativado'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {!isMe &&
                        (confirmingDelete === u.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-danger">Excluir {u.name}?</span>
                            <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(null)} disabled={busy}>
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => remove.mutate(u)}
                              disabled={busy}
                              className="bg-danger text-white hover:bg-danger/90"
                            >
                              Excluir
                            </Button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate(u)} disabled={busy}>
                              {u.is_active ? 'Desativar' : 'Reativar'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setError(null)
                                setConfirmingDelete(u.id)
                              }}
                              disabled={busy}
                              className="text-danger"
                            >
                              Excluir
                            </Button>
                          </span>
                        ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {usersQuery.isLoading && <p className="px-4 py-3 text-[13px] text-muted">Carregando usuários…</p>}
          {usersQuery.isError && (
            <p className="px-4 py-3 text-[13px] text-danger">Não foi possível carregar os usuários.</p>
          )}
        </div>

        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold">Novo usuário</h2>
          {created && (
            <p role="status" className="mb-4 rounded-md border border-primary-soft-line bg-primary-soft px-3 py-2 text-[13px]">
              Conta de {created} criada. Passe o e-mail e a senha para a pessoa entrar.
            </p>
          )}
          <UserForm
            submitLabel="Criar usuário"
            pendingLabel="Criando…"
            onCreated={(user) => {
              setCreated(user.email)
              refresh()
            }}
          />
        </div>
      </div>
    </>
  )
}
