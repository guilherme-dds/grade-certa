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
  lib/          # utilitários (classes, erros da API, horários da grade)
  pages/        # telas
  schedule/     # estado da grade e dos conflitos (ScheduleProvider, useSchedule)
  router.tsx
```

## Estado atual

- **Integrado com a API:** login (`POST /auth/login`), usuário logado (`GET /auth/me`) e
  cadastro (`POST /users/`, tela em `/cadastro`, fora do menu — o design prevê acesso por convite).
- **Integrado com o core-service:** cadastros, disponibilidade, geração automática (`/geracao`),
  grade (`/grade`) e conflitos (`/conflitos`).
- **Relatórios (`/relatorios`):** visão geral, grade por professor, por turma e por sala. Os
  indicadores são calculados no front (`src/pages/reports/reportMetrics.ts`). "Exportar PDF" usa a
  impressão do navegador. Planejamentos e janelas vêm da geração e não mudam com edição manual.
- **Minha grade (`/minha-grade`):** semana do professor logado, ligado ao cadastro pelo e-mail.
- **Perfis:** o backend ainda não retorna `role` no usuário; todos entram como Coordenação.
  Em desenvolvimento, o seletor "Visualizar como" na sidebar simula os outros perfis.

## Variáveis de ambiente

`VITE_API_URL` (opcional, padrão `/api`) — ver `.env.example`.
