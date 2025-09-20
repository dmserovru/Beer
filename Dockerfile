
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --production --silent
COPY server ./server
COPY client ./client
WORKDIR /app/server
EXPOSE 3003
CMD ["node", "server.js"]