FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY kb ./kb
COPY prompts ./prompts
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8788

EXPOSE 8788

CMD ["node", "src/server.js"]