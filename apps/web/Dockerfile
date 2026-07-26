FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@veline/web"]
