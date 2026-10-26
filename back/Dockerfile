FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts && npm install sequelize-cli

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
