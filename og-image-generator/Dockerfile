FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache git
ARG OG_IMAGE_GENERATOR_REF=2146e4e8c643b5f44d0a3f96f51b088b1ac9d852
RUN git clone https://github.com/jappyjan/og-image-generator.git . \
 && git checkout "$OG_IMAGE_GENERATOR_REF"

RUN npm ci
RUN npm run build

EXPOSE 3003
CMD ["npm", "start"]
