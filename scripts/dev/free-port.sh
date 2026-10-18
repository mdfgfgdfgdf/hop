#!/usr/bin/env bash
# Stops whatever listens on the given port and waits until it is free.
# lsof may not see listeners in some containers, so fuser and ss are tried too.
port="$1"
pids_on() {
  { lsof -ti:"$port" 2>/dev/null; fuser -n tcp "$port" 2>/dev/null; ss -ltnpH "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2; } | tr -s ' \n' '\n' | grep -E '^[0-9]+$' | sort -u
}
for i in $(seq 1 30); do
  pids=$(pids_on)
  [ -z "$pids" ] && exit 0
  kill $pids 2>/dev/null || true
  sleep 0.5
done
pids=$(pids_on); [ -n "$pids" ] && kill -9 $pids 2>/dev/null; sleep 0.5; exit 0
