#!/bin/bash
# /zip-review.sh
zip -r worshipos-review.zip ui src schema.sql migrations package.json package-lock.json .env.example \
  -x "**/node_modules/*" "**/.svelte-kit/*" "**/build/*" "**/dist/*" "**/.DS_Store"
