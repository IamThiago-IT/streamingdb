# 🐳 Guia Docker do StreamingDB

Este documento detalha como usar Docker para desenvolvimento, testes e produção do StreamingDB.

## Conteúdo

1. [Início Rápido](#início-rápido)
2. [Estrutura Docker](#estrutura-docker)
3. [Desenvolvimento com Docker](#desenvolvimento-com-docker)
4. [Produção](#produção)
5. [Troubleshooting](#troubleshooting)

---

## Início Rápido

### Executar a Aplicação Completa

```bash
# Clonar repositório
git clone <seu-repositorio>
cd streamingdb

# Copiar variáveis de ambiente
cp .env.example .env.local

# Iniciar serviços (banco de dados + aplicação)
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f
```

A aplicação estará disponível em: **http://localhost:3000**

---

## Estrutura Docker

### Serviços no `docker-compose.yml`

#### 1. **PostgreSQL (Banco de Dados)**
- **Imagem**: `postgres:16-alpine`
- **Porta**: `5432`
- **Variáveis de ambiente**:
  - `POSTGRES_USER`: Nome do usuário (padrão: `streamingdb_user`)
  - `POSTGRES_PASSWORD`: Senha (padrão: `streamingdb_password`)
  - `POSTGRES_DB`: Nome do banco (padrão: `streamingdb`)
- **Volume**: `postgres_data` (persiste dados mesmo após parar o container)

#### 2. **Next.js App**
- **Imagem**: Construída a partir do `Dockerfile`
- **Porta**: `3000`
- **Dependências**: Aguarda banco de dados estar pronto
- **Network**: Conectado à `streamingdb-network` para comunicação com o BD

### Dockerfile (Multi-stage)

O `Dockerfile` usa duas etapas para otimizar o tamanho da imagem:

**Etapa 1 (Builder)**:
- Instala dependências
- Compila a aplicação Next.js
- Gera Prisma Client

**Etapa 2 (Runtime)**:
- Base limpa com apenas dependências de produção
- Copia apenas arquivos necessários
- Reduz tamanho da imagem final

---

## Desenvolvimento com Docker

### Execução Básica

```bash
# Iniciar em modo anexado (veja logs em tempo real)
docker-compose up

# Iniciar em background
docker-compose up -d
```

### Acessar o Console da Aplicação

```bash
docker-compose exec app sh
```

Dentro do container, você pode executar:

```bash
# Prisma Studio (UI para gerenciar banco de dados)
pnpm prisma studio

# Migrations
pnpm prisma migrate dev --name <nome>
pnpm prisma db seed

# Lint
pnpm lint

# Build
pnpm build
```

### Monitorar Logs

```bash
# Todos os serviços
docker-compose logs -f

# Apenas a aplicação
docker-compose logs -f app

# Apenas o banco de dados
docker-compose logs -f db

# Últimas 100 linhas
docker-compose logs --tail=100
```

### Gerenciar Containers

```bash
# Listar containers em execução
docker-compose ps

# Parar serviços
docker-compose stop

# Iniciar serviços parados
docker-compose start

# Reiniciar serviços
docker-compose restart

# Remover containers e volumes
docker-compose down -v
```

### Resetar Banco de Dados

Para limpar completamente o banco de dados e começar do zero:

```bash
# Remove containers e volumes
docker-compose down -v

# Recria e inicia
docker-compose up -d
```

### Rebuild da Imagem

Quando alterar dependências ou configuração:

```bash
# Rebuild sem cache
docker-compose build --no-cache

# Restart com nova imagem
docker-compose up -d
```

---

## Produção

### Build da Imagem Customizada

```bash
# Build com tag customizada
docker build -t streamingdb:latest .

# Build com variantes
docker build -t streamingdb:v1.0.0 .
```

### Executar Container Isolado

```bash
# Com postgres local
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e NODE_ENV=production \
  --name streamingdb-app \
  streamingdb:latest
```

### Docker Registry (Push para Hub)

```bash
# Tag para registry
docker tag streamingdb:latest seu-usuario/streamingdb:latest

# Fazer login
docker login

# Push
docker push seu-usuario/streamingdb:latest
```

### Deployment Stack Completo

Para ambientes de produção com múltiplas réplicas:

```bash
# Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml streamingdb

# Kubernetes (usando manifesto)
kubectl apply -f k8s/
```

---

## Troubleshooting

### Container Não Inicia

```bash
# Verificar logs de erro
docker-compose logs app

# Verificar health check
docker-compose ps

# Rebuild completo
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Conexão Recusada ao Banco de Dados

```bash
# Verificar se banco de dados está saudável
docker-compose exec db pg_isready -U streamingdb_user

# Verificar logs do database
docker-compose logs db

# Aguardar banco de dados iniciar e fazer restart da app
docker-compose restart app
```

### Porta já em uso

```bash
# Mudar porta no docker-compose.yml
# Alterar:
# ports:
#   - "3000:3000"  
# Para:
#   - "3001:3000"

# Ou encontrar processo na porta
lsof -i :3000
kill -9 <PID>
```

### Problemas com Volume de Dados

```bash
# Listar volumes
docker volume ls

# Inspecionar volume
docker volume inspect streamingdb_postgres_data

# Remover volume
docker volume rm streamingdb_postgres_data
```

### Cache de Dependências Desatualizado

```bash
# Limpar buildkit cache
docker buildx prune -a

# Rebuild sem cache
docker-compose build --no-cache --pull
```

### Problemas de Permissão

Se encontrar problemas de permissão em volumes:

```bash
# No docker-compose.yml, adicione ao serviço 'app':
# user: "node"
# ou
# user: "1000:1000"  # UID:GID do seu usuário
```

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` baseado em `.env.example`:

```bash
# Banco de Dados
POSTGRES_USER=streamingdb_user
POSTGRES_PASSWORD=streamingdb_password
POSTGRES_DB=streamingdb

# Next.js
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3000

# Aplicação
DEBUG=false
```

---

## Recursos Adicionais

- [Documentação Docker Compose](https://docs.docker.com/compose/)
- [Documentação Docker](https://docs.docker.com/)
- [Best Practices Node.js em Docker](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PostgreSQL em Docker](https://hub.docker.com/_/postgres)

---

## Suporte

Encontrou algum problema? Abra uma issue no repositório!
