# 마케팅챕터 이미지 스튜디오 — 프록시 모드 컨테이너 (키를 서버에만 보관)
FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 설치 (레이어 캐시)
COPY package*.json ./
RUN npm ci

# 소스 복사 후 프록시 모드로 빌드
COPY . .
RUN npm run build:proxy

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# OPENAI_API_KEY 는 런타임에 주입: docker run -e OPENAI_API_KEY=sk-...
CMD ["node", "server/index.js"]
