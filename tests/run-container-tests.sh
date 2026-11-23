#!/bin/sh
set -eu

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
tar -C /src --exclude=./.git --exclude=node_modules --exclude=./dist --exclude=./coverage \
  --exclude=./.env --exclude=./.env.local -cf - . | tar -C "$workdir" -xf -
cd "$workdir"

npm ci --no-audit --no-fund
npm test -- --coverage --mode coverage-unit
npm test -- --coverage --mode coverage-integration
npm run lint
npm run build
