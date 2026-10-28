#!/bin/bash
# Start script for PM2 deployment
# This sources the .env file and starts the bun server

set -a
source /home/ubuntu/shiksha-ai/backend/.env
set +a
exec /home/ubuntu/.bun/bin/bun src/index.ts
