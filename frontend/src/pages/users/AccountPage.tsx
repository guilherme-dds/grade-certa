import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { changeMyPassword } from '@/api/users'
import { useAuth } from '@/auth/useAuth'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
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
    mutationFn: ({ currentPassword, newPassword }: PasswordFormValues) => changeMyPassword(currentPassword, newPassword),
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
      <PageHeader title="Minha conta" description={user ? `${user.name} · ${user.email}` : undefined} />

      <div className="max-w-md rounded-lg border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold">Trocar senha</h2>
        {changed && (
          <p role="status" className="mb-4 rounded-md border border-primary-soft-line bg-primary-soft px-3 py-2 text-[13px]">
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
    </>
  )
}
