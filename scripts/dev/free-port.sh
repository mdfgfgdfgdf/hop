#!/usr/bin/env bash
# Stops whatever listens on the given port and waits until it is free.
port="$1"
for i in $(seq 1 30); do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  [ -z "$pids" ] && exit 0
  kill $pids 2>/dev/null || true
  sleep 0.5
done
pids=$(lsof -ti:"$port" 2>/dev/null || true); [ -n "$pids" ] && kill -9 $pids 2>/dev/null; sleep 0.5; exit 0
