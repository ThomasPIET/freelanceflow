FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Code et dépendances appartiennent à root : l'utilisateur node peut les lire, pas les modifier
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Migrations, création de l'admin initial, puis démarrage de l'API
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node scripts/create-admin.js && node server.js"]
