#!/usr/bin/env bash
set -e

cd /root/bunker-hr-game

git fetch --all
git reset --hard origin/main

# зависимости (ВАЖНО)
npm ci --omit=dev

# prisma если используется (если нет папки prisma — можно убрать)
if [ -f "prisma/schema.prisma" ]; then
  npx prisma generate
fi

# pm2: старт/перезапуск с env из ecosystem
pm2 startOrReload ecosystem.config.cjs --update-env

pm2 save
