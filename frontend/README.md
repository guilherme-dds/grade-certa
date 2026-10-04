# GradeCerta — Front-end

React 19 + Vite + TypeScript + Tailwind v4. Design de referência no Claude Design
(`GradeCerta.dc.html` e `Fluxos.dc.html`).

## Scripts

```bash
npm run dev      # servidor de desenvolvimento (http://localhost:5173)
npm run build    # checagem de tipos + build de produção em dist/
npm run lint     # oxlint
```

## Estrutura

```
src/
  api/          # cliente Axios (token + tratamento de 401) e funções por recurso
  auth/         # AuthProvider, useAuth, guards de rota, perfis (roles)
  components/   # FormField e componentes de UI (Button, StatCard, DataTable, PageHeader)
  config/       # menu por perfil
  layouts/      # AuthLayout (login) e AppLayout (sidebar)
  mocks/        # dados de exemplo do protótipo — substituir pela API
  pages/        # telas
  schedule/     # estado da grade e dos conflitos (ScheduleProvider, useSchedule)
  router.tsx
```

## Estado atual

- **Integrado com a API:** login (`POST /auth/login`), usuário logado (`GET /auth/me`) e
  cadastro (`POST /users/`, tela em `/cadastro`, fora do menu — o design prevê acesso por convite).
- **Dados de exemplo (`src/mocks/`):** dashboards, disciplinas, salas, grade e conflitos. Ainda
  não há endpoints para esses recursos.
- **Grade gerada (`/grade`) e Conflitos (`/conflitos`):** interativas sobre os dados de exemplo
  (`src/schedule/ScheduleProvider.tsx`). A coordenação reatribui professor, sala ou horário de
  uma aula; aplicar uma sugestão (ou editar a aula manualmente) resolve o conflito. O estado fica
  só em memória e volta ao inicial ao recarregar a página.
- **Perfis:** o backend ainda não retorna `role` no usuário; todos entram como Coordenação.
  Em desenvolvimento, o seletor "Visualizar como" na sidebar simula os outros perfis.
- **Em construção:** Geração automática e Relatórios.

## Variáveis de ambiente

`VITE_API_URL` (opcional, padrão `/api`) — ver `.env.example`.
