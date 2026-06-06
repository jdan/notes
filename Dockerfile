FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends g++ make python3 \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ENV HOST=0.0.0.0
ENV PORT=3000
ENV BUILD=/app/site

EXPOSE 3000

CMD ["npm", "run", "serve"]
