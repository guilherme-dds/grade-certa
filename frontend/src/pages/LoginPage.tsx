import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation, useNavigate, type Location } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginLocationState {
  from?: Location
  registered?: boolean
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LoginLocationState | null
  const from = state?.from?.pathname ?? '/'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (error) {
      setError('root', { message: getApiErrorMessage(error) })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="mb-1 text-[19px] font-semibold">Entrar</h1>
      <p className="mb-6 text-[13px] text-muted">Acesse com o e-mail cadastrado pela coordenação.</p>

      {state?.registered && (
        <p className="mb-4 rounded-md border border-primary-soft-line bg-primary-soft px-3 py-2 text-[13px]">
          Conta criada! Faça login para continuar.
        </p>
      )}

      <div className="space-y-4">
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
      </div>

      {errors.root && (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-6 w-full">
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>

      <p className="mt-5 border-t border-line-soft pt-5 text-[12.5px] leading-normal text-muted">
        Primeiro acesso? Verifique o convite enviado por e-mail pela coordenação.
      </p>
    </form>
  )
}
