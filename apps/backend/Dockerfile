# syntax=docker/dockerfile:1.7
# Image of the backend, built from the monorepo root:
#   docker build -f apps/backend/Dockerfile -t jaja-backend .
#   docker build -f apps/backend/Dockerfile --target migrate -t jaja-backend-migrate .
#
# Targets:
# - runtime (default): the API (`entrypoint.mjs serve`), production dependencies only;
# - migrate: `prisma migrate deploy` + optional seed (`entrypoint.mjs migrate`),
#   with the Prisma CLI and tsx, which the API does not need.
# Both run as the `node` user. The RDS CA bundle goes to /app/certs and is
# trusted by Node through NODE_EXTRA_CA_CERTS (TLS with certificate check).

ARG NODE_IMAGE=node:24-bookworm-slim
ARG TURBO_VERSION=2.10.12

# Only the workspaces the backend depends on (modules/*, packages/shared), with
# a pruned lockfile: package.json files first, sources after, for layer cache.
FROM ${NODE_IMAGE} AS prune
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN npx --yes turbo@${TURBO_VERSION} prune @jaja/backend --docker

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=prune /repo/out/json/ ./
RUN npm ci --no-audit --no-fund
COPY --from=prune /repo/out/full/ ./
# The modules extend this tsconfig by relative path, without declaring it as a
# dependency, so `turbo prune` leaves it out.
COPY --from=prune /repo/packages/typescript-config/ ./packages/typescript-config/
# `prisma.config.ts` requires DATABASE_URL even to generate the client; nothing connects.
RUN cd apps/backend \
  && DATABASE_URL="postgresql://build:build@localhost:5432/build" npx --no-install prisma generate
RUN npx --no-install turbo run build --filter=@jaja/backend
# Build outputs of every workspace, with their paths, for the runtime stage.
RUN mkdir /out && for dir in apps/* modules/* packages/*; do \
      if [ -d "$dir/dist" ]; then mkdir -p "/out/$dir" && cp -r "$dir/dist" "/out/$dir/"; fi; \
    done

# Production dependencies only, installed apart: `--legacy-peer-deps` because
# @prisma/client declares the Prisma CLI (and with it Studio, React and
# TypeScript) as a peer dependency, which the API never runs. Then the build
# outputs and the generated Prisma client come from the build stage.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY --from=prune /repo/out/json/ ./
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund
COPY --from=prune /repo/out/full/ ./
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /out/ ./

FROM ${NODE_IMAGE} AS base
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem \
    PORT=4000
WORKDIR /app
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
RUN chmod 755 /app/certs && chmod 644 /app/certs/rds-global-bundle.pem

FROM base AS migrate
COPY --from=build --chown=node:node /app ./
USER node
WORKDIR /app/apps/backend
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
CMD ["migrate"]

FROM base AS runtime
COPY --from=prod-deps --chown=node:node /app ./
USER node
WORKDIR /app/apps/backend
EXPOSE 4000
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
CMD ["serve"]
