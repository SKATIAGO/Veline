FROM node:22-slim

# Prisma necesita openssl en las imágenes slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalamos dependencias con el manifiesto de todos los workspaces
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

COPY . .

# Cliente de Prisma dentro de la imagen (queda en el volumen anónimo de node_modules)
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

EXPOSE 3001
CMD ["npm", "run", "start:docker", "-w", "@veline/api"]
