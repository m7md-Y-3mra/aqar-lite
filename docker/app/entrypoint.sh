#!/bin/sh
set -eu
node --conditions=react-server scripts/check-env.ts
node_modules/.bin/prisma migrate deploy
node_modules/.bin/prisma db seed
exec node_modules/.bin/next start -H 0.0.0.0 -p 3000
