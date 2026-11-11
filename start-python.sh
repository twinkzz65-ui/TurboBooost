#!/usr/bin/env sh
# Termux: pkg install python   (один раз), затем: sh start-python.sh
cd "$(dirname "$0")" && exec python godgram_server.py --lan "$@"
