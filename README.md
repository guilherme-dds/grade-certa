# GradeCerta

Sistema web de geração automática de grade horária escolar.

- `backend/` — API em FastAPI + SQLAlchemy + MySQL
- `frontend/` — SPA em React + Vite + TypeScript + Tailwind

## Rodando o projeto completo (Docker)

Pré-requisito: Docker. A porta `3306` precisa estar livre (MySQL).

```bash
cp .env.example .env
docker compose up --build
```

| Serviço  | URL                          |
|----------|------------------------------|
| Front    | http://localhost:3000        |
| API      | http://localhost:8000        |
| API docs | http://localhost:8000/docs   |

Para entrar no sistema, crie uma conta em http://localhost:3000/cadastro e faça login.

## Rodando só o front (desenvolvimento)

Pré-requisito: Node 20.19+ ou 22.12+.

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. As chamadas para `/api/*` são repassadas para `http://localhost:8000`
(ver `frontend/vite.config.ts`); sem o backend no ar, as telas abrem normalmente, mas o login
retorna "Servidor indisponível".

Mais detalhes em [`frontend/README.md`](frontend/README.md).
