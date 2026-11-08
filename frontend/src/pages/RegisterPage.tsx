import { Link, useNavigate } from 'react-router'
import { UserForm } from './users/UserForm'

// Só o primeiro usuário do sistema se cadastra por aqui; depois, quem já tem acesso
// cria as contas em Usuários (o backend recusa o cadastro sem login).

export function RegisterPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1 className="mb-1 text-[19px] font-semibold">Criar conta</h1>
      <p className="mb-6 text-[13px] text-muted">
        Disponível só no primeiro acesso ao sistema. Depois, as contas são criadas por quem já tem acesso.
      </p>

      <UserForm
        submitLabel="Criar conta"
        pendingLabel="Criando conta…"
        onCreated={() => navigate('/login', { replace: true, state: { registered: true } })}
      />

      <p className="mt-5 border-t border-line-soft pt-5 text-[12.5px] text-muted">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
