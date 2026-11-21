# Estágio 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

ENV NEXT_TELEMETRY_DISABLED=1
# Gera .next/standalone para a imagem de runtime. A Vercel usa a saída padrão.
ENV NEXT_OUTPUT=standalone

# Copiar arquivos de dependência
COPY package.json pnpm-lock.yaml ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código-fonte
COPY . .

# Gerar Prisma Client e compilar o Next.js.
# As migrations rodam no start do container, não no build.
RUN pnpm prisma generate && pnpm exec next build

# Estágio 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copiar arquivos necessários do estágio builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Expor porta
EXPOSE 3000

# Health check (a rota consulta o banco)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Aplica migrations pendentes e sobe o servidor standalone
CMD ["sh", "-c", "pnpm prisma migrate deploy && node server.js"]
