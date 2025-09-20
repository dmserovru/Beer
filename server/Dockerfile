FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production --silent
COPY . .
# copy client into image (context: build from server directory, so client is ../client)
COPY ../client ./client
EXPOSE 3003
CMD ["node", "server.js"]
