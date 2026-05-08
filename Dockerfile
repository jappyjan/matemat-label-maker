FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
# `npm install` (not `npm ci`) so platform-mismatched optional binaries
# (e.g. @esbuild/aix-ppc64) don't fail the install on linux/x64.
RUN npm install --no-audit --no-fund

COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

ENV NODE_ENV=production
RUN mkdir -p /data/uploads
EXPOSE 3000
CMD ["npm", "run", "start"]
