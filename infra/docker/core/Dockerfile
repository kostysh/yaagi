FROM node:22-alpine

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json tsconfig.typecheck.json ./
COPY apps/core/package.json apps/core/package.json
COPY apps/workshop/package.json apps/workshop/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/evals/package.json packages/evals/package.json
COPY packages/skills/package.json packages/skills/package.json
COPY packages/testkits/package.json packages/testkits/package.json

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY apps/core ./apps/core
COPY packages ./packages
COPY infra/migrations ./infra/migrations
COPY workspace/constitution ./workspace/constitution

RUN mkdir -p /workspace/body /workspace/skills /workspace/constitution /models /data /tmp

USER node

EXPOSE 8080

CMD ["node", "--experimental-strip-types", "apps/core/src/main.ts"]
