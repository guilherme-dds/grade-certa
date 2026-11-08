import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { createUser } from '@/api/users'
import type { User } from '@/api/types'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'

const userSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.').max(100, 'Máximo de 100 caracteres.'),
    email: z.email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
  submitLabel: string
  pendingLabel: string
  onCreated: (user: User) => void
}

/** Cadastro de usuário: primeiro acesso (tela pública) ou criado por quem já está logado. */
export function UserForm({ submitLabel, pendingLabel, onCreated }: UserFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({ resolver: zodResolver(userSchema) })

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      reset()
      onCreated(user)
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  })

  const onSubmit = handleSubmit(({ name, email, password }) => mutation.mutate({ name, email, password }))

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="space-y-4">
        <FormField label="Nome" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <FormField
          label="Senha"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="Confirmar senha"
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

      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-6 w-full">
        {mutation.isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
