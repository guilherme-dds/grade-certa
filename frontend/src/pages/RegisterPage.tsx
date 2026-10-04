import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { createUser } from '@/api/users'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'

// O design prevê acesso só por convite da coordenação. Esta tela fica fora do menu
// (acessível por /cadastro) até o fluxo de convite existir no backend.

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe seu nome.').max(100, 'Máximo de 100 caracteres.'),
    email: z.email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => navigate('/login', { replace: true, state: { registered: true } }),
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  })

  const onSubmit = handleSubmit(({ name, email, password }) =>
    mutation.mutate({ name, email, password }),
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="mb-1 text-[19px] font-semibold">Criar conta</h1>
      <p className="mb-6 text-[13px] text-muted">Preencha seus dados para acessar o GradeCerta.</p>

      <div className="space-y-4">
        <FormField label="Nome" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
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
        {mutation.isPending ? 'Criando conta…' : 'Criar conta'}
      </Button>

      <p className="mt-5 border-t border-line-soft pt-5 text-[12.5px] text-muted">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
