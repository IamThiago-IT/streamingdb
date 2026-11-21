# Docker

Este guia cobre o uso de Docker para desenvolvimento e produção do StreamingDB.
A configuração é composta por `Dockerfile` (multi-stage) e `docker-compose.yml`
(Postgres + aplicação).

## Início rápido

1. Instale [Docker](https://www.docker.com/get-started) e Docker Compose.
2. Crie o arquivo de variáveis que o Compose lê (`.env`, não `.env.local`):

```bash
cp .env.example .env
```

3. Edite `.env` e defina um `BETTER_AUTH_SECRET` real:

```bash
npx @better-auth/cli secret
```

4. Suba os serviços:

```bash
docker compose up -d --build
```

5. Acompanhe o start (o container aplica migrations antes de subir):

```bash
docker compose ps
docker compose logs -f app
```

6. Acesse `http://localhost:3000`. O health check fica em
   `http://localhost:3000/api/health`.

## Serviços

### `db` — PostgreSQL 16

- Imagem `postgres:16-alpine`.
- Porta `5432` publicada no host.
- Credenciais padrão: `streamingdb_user` / `streamingdb_password` /
  `streamingdb` (sobrescreva via `POSTGRES_*`).
- Volume `postgres_data` persiste os dados entre reinícios.
- Health check com `pg_isready`; a aplicação só sobe quando o banco está
  saudável.

### `app` — Next.js

- Build a partir do `Dockerfile`.
- Exposta na porta `3000`.
- `DATABASE_URL` é montada automaticamente a partir de `POSTGRES_*`, apontando
  para o host `db`. Para usar outro Postgres, defina `DOCKER_DATABASE_URL`.
- Recebe `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e as credenciais sociais do
  `.env`.
- `restart: unless-stopped`.

## Como a imagem é construída

**Estágio `builder`:**

1. Instala pnpm e as dependências com lockfile congelado.
2. Define `NEXT_OUTPUT=standalone`.
3. Roda `prisma generate` e `next build`.
4. Gera `.next/standalone` com apenas o necessário para produção.

**Estágio de runtime:**

1. Copia `public/`, `.next/standalone`, `.next/static`, `node_modules`,
   `package.json`, `prisma/` e `prisma.config.ts`.
2. Define `PORT=3000` e `HOSTNAME=0.0.0.0`.
3. No start: `pnpm prisma migrate deploy && node server.js`.
4. Health check HTTP em `/api/health`.

> As migrations rodam **no start**, não no build. O build da imagem não precisa
> de acesso ao banco.

## Primeiro uso do banco

O container aplica as migrations, mas não roda seed automaticamente. Com o
Postgres publicado na porta `5432`, rode a partir da máquina host:

```bash
# PowerShell
$env:DATABASE_URL="postgresql://streamingdb_user:streamingdb_password@localhost:5432/streamingdb"
$env:DIRECT_URL=$env:DATABASE_URL
pnpm db:seed
pnpm seed:offers --file=data/offers.csv
```

```bash
# bash/zsh
DATABASE_URL="postgresql://streamingdb_user:streamingdb_password@localhost:5432/streamingdb" \
DIRECT_URL="postgresql://streamingdb_user:streamingdb_password@localhost:5432/streamingdb" \
pnpm db:seed
```

> Os scripts não são copiados para a imagem de runtime (apenas o servidor
> standalone). Use o host para seed, importação e Prisma Studio.

## Comandos úteis

```bash
# Logs
docker compose logs -f
docker compose logs -f app
docker compose logs -f db

# Status
docker compose ps

# Shell no container
docker compose exec app sh

# Parar / iniciar / reiniciar
docker compose stop
docker compose start
docker compose restart

# Remover containers e volumes (apaga o banco)
docker compose down -v

# Rebuild sem cache
docker compose build --no-cache
docker compose up -d

# Prisma Studio a partir do host
pnpm db:studio
```

## Variáveis do `.env`

| Variável | Padrão | Uso |
|---|---|---|
| `POSTGRES_USER` | `streamingdb_user` | Usuário do banco local. |
| `POSTGRES_PASSWORD` | `streamingdb_password` | Senha do banco local. |
| `POSTGRES_DB` | `streamingdb` | Nome do banco. |
| `DOCKER_DATABASE_URL` | — | Sobrescreve a URL do banco usada pelo container (ex.: Postgres externo). |
| `BETTER_AUTH_SECRET` | — | **Obrigatória em produção.** |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL pública. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | vazio | Habilita login Google. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | vazio | Habilita login GitHub. |
| `NODE_ENV` | `production` | Ambiente do container. |

> `DATABASE_URL` no `.env` serve ao desenvolvimento local; o Compose monta a URL
> do container a partir de `POSTGRES_*`. Para apontar a outro banco, use
> `DOCKER_DATABASE_URL`.

## Produção

- Não use as senhas padrão do Compose; defina `POSTGRES_PASSWORD` forte.
- A porta `5432` está publicada para facilitar o desenvolvimento. Em produção,
  remova o mapeamento ou restrinja o acesso.
- Sirva a aplicação atrás de HTTPS (proxy reverso ou plataforma gerenciada) e
  ajuste `BETTER_AUTH_URL`.
- Faça backup do volume (`postgres_data`) ou use um Postgres gerenciado.
- O health check pode ser usado por orquestradores:

```bash
docker build -t streamingdb:latest .
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e BETTER_AUTH_SECRET="..." \
  -e BETTER_AUTH_URL="https://seu-dominio" \
  --name streamingdb-app \
  streamingdb:latest
```

## Troubleshooting

### Container da aplicação reinicia

```bash
docker compose logs app
```

Verifique `DATABASE_URL`, `BETTER_AUTH_SECRET` e se o banco está saudável.

### Banco não fica pronto

```bash
docker compose exec db pg_isready -U streamingdb_user
docker compose logs db
```

### Porta em uso

Altere o mapeamento em `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"
```

E ajuste `BETTER_AUTH_URL`/callback OAuth para a nova URL.

### Reset completo do banco

```bash
docker compose down -v
docker compose up -d --build
```

### Build falha em `next build`

- Confirme que `NEXT_OUTPUT=standalone` está definido no estágio `builder`.
- Verifique se o código compila com `pnpm build` localmente (com Postgres).
- Rode `docker compose build --no-cache`.

### Login social não aparece

As credenciais precisam estar no `.env` **antes** de criar o container:

```bash
docker compose up -d --force-recreate
```

## Referências

- [Docker Compose](https://docs.docker.com/compose/)
- [PostgreSQL no Docker](https://hub.docker.com/_/postgres)
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
