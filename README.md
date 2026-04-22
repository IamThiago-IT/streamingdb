# StreamingDB

Uma aplicação web moderna para gerenciar e visualizar dados em tempo real, construída com as tecnologias mais recentes do ecossistema JavaScript/TypeScript.

## 🚀 Tecnologias

- **Next.js 16.2** - Framework React com SSR/SSG
- **React 19** - Biblioteca UI moderna
- **TypeScript 5** - Type safety para JavaScript
- **Prisma** - ORM type-safe para bancos de dados
- **PostgreSQL** - Banco de dados relacional
- **Tailwind CSS 4** - Utility-first CSS framework
- **ESLint 9** - Linter para qualidade de código

## 📋 Pré-requisitos

- Node.js 18+ 
- pnpm (recomendado) ou npm
- PostgreSQL 12+

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd streamingdb
```

2. Instale as dependências:
```bash
pnpm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```

4. Configure a variável `DATABASE_URL` no arquivo `.env.local`:
```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/streamingdb"
```

5. Execute as migrações do Prisma:
```bash
pnpm prisma migrate dev
```

## 🚀 Desenvolvimento

Inicie o servidor de desenvolvimento:

```bash
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador para ver o resultado.

O aplicativo será recarregado automaticamente quando você editar os arquivos.

## 📁 Estrutura do Projeto

```
streamingdb/
├── app/                    # Aplicação Next.js App Router
│   ├── page.tsx           # Página principal
│   ├── layout.tsx         # Layout raiz
│   └── globals.css        # Estilos globais
├── prisma/                # Configuração e schema do Prisma
│   └── schema.prisma      # Definição do modelo de dados
├── public/                # Arquivos estáticos
├── package.json           # Dependências do projeto
├── tsconfig.json          # Configuração TypeScript
├── next.config.ts         # Configuração Next.js
└── eslint.config.mjs      # Configuração ESLint
```

## 🔨 Comandos Disponíveis

- `pnpm dev` - Inicia servidor de desenvolvimento
- `pnpm build` - Compila para produção
- `pnpm start` - Inicia servidor em produção
- `pnpm lint` - Executa verificações de linting
- `pnpm prisma studio` - Abre Prisma Studio para gerenciar dados

## 📦 Build para Produção

```bash
pnpm build
pnpm start
```

## 🗄️ Banco de Dados

O projeto usa Prisma como ORM. Para gerenciar o banco de dados:

```bash
# Criar nova migração
pnpm prisma migrate dev --name nome_da_migracao

# Visualizar dados
pnpm prisma studio

# Resetar banco (cuidado!)
pnpm prisma migrate reset
```

## 🎨 Estilos

O projeto utiliza Tailwind CSS para estilização. Os estilos globais estão em `app/globals.css`.

## 📝 Licença

MIT

## 👨‍💻 Contribuindo

Sinta-se à vontade para abrir issues e pull requests.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
