FROM node:22-bookworm-slim

WORKDIR /app

COPY SKILL.md ./SKILL.md
COPY references ./references
COPY prototype/wechat-mini-program/server/package.json ./prototype/wechat-mini-program/server/package.json
COPY prototype/wechat-mini-program/server/src ./prototype/wechat-mini-program/server/src
COPY prototype/wechat-mini-program/server/scripts ./prototype/wechat-mini-program/server/scripts

WORKDIR /app/prototype/wechat-mini-program/server

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=/data/goutoujunshi.sqlite \
    ALLOW_DEV_AUTH=false \
    BETA_CAMPAIGN_QUOTA=1000 \
    BETA_INVITE_REQUIRED=true

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/app.js"]
