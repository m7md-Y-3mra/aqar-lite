#!/bin/sh
set -eu
node --conditions=react-server scripts/check-env.ts
npx prisma migrate deploy
npx prisma db seed
exec npx next start -H 0.0.0.0 -p 3000
