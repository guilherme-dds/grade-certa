import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { changeMyPassword } from '@/api/users'
import { useAuth } from '@/auth/useAuth'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'
import { getApiErrorMessage } from '@/lib/apiError'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export function AccountPage() {
  const { user } = useAuth()
  const [changed, setChanged] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordFormValues) =>
      changeMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      reset()
      setChanged(true)
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  })

  const onSubmit = handleSubmit((values) => {
    setChanged(false)
    mutation.mutate(values)
  })

  return (
    <>
      <TabHeader title="Minha conta" description="Seus dados de acesso ao Grade Certa." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
        {user && (
          <section className="card p-6 md:p-7" aria-labelledby="seus-dados">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink font-display text-[18px] font-bold text-white">
                {iniciais(user.name)}
              </span>
              <div className="min-w-0">
                <h2 id="seus-dados" className="truncate font-display text-[20px] font-bold">
                  {user.name}
                </h2>
                <p className="truncate text-[14px] text-muted">{user.email}</p>
              </div>
            </div>
            <dl className="mt-6 divide-y divide-line-soft border-t border-line-soft text-[14px]">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Situação</dt>
                <dd className="font-semibold">{user.is_active ? 'Ativa' : 'Inativa'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Conta criada em</dt>
                <dd className="font-semibold">{new Date(user.created_at).toLocaleDateString('pt-BR')}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] text-muted">
              Outras pessoas da coordenação entram com contas próprias, criadas em{' '}
              <Link to={paths.usuarios} className="font-semibold text-primary hover:underline">
                Usuários
              </Link>
              .
            </p>
          </section>
        )}

        <div className="card p-6 md:p-7">
          <h2 className="mb-4 font-display text-[20px] font-bold">Trocar senha</h2>
          {changed && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-primary-soft-line bg-primary-soft px-3 py-2 text-[13px]"
            >
              Senha alterada. Use a nova senha no próximo login.
            </p>
          )}
          <form onSubmit={onSubmit} noValidate>
            <div className="space-y-4">
              <FormField
                label="Senha atual"
                type="password"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                {...register('currentPassword')}
              />
              <FormField
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />
              <FormField
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>

            {errors.root && (
              <p className="mt-4 text-[13px] text-danger" role="alert">
                {errors.root.message}
              </p>
            )}

            <Button type="submit" disabled={mutation.isPending} className="mt-6">
              {mutation.isPending ? 'Salvando…' : 'Trocar senha'}
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
