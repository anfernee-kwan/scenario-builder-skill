#!/usr/bin/env bash
# setup-test-db.sh — 在 npm test (pretest hook) 时自动创建并迁移测试库
# 测试库名 = 开发库名 + "_test"，二者完全隔离，避免 resetDb() TRUNCATE 开发数据。
set -euo pipefail

# 从 DATABASE_URL（开发库）推导测试库 URL
DEV_URL="${DATABASE_URL:-postgres://clawlake:clawlake@127.0.0.1:5432/app}"
TEST_URL="${DEV_URL}_test"

# 解析连接参数
PROTO="${DEV_URL%%://*}"
REST="${DEV_URL#*://}"
USERPASS="${REST%%@*}"
HOSTPATH="${REST#*@}"
DB_USER="${USERPASS%%:*}"
DB_PASS="${USERPASS#*:}"
DB_HOST="${HOSTPATH%%:*}"
PORT_AND_DB="${HOSTPATH#*:}"
DB_PORT="${PORT_AND_DB%%/*}"
DEV_DB="${PORT_AND_DB#*/}"
TEST_DB="${DEV_DB}_test"

echo "[setup-test-db] test DB: ${TEST_DB} @ ${DB_HOST}:${DB_PORT}"

# 创建测试库（已存在则跳过）
PGPASSWORD="${DB_PASS}" psql \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DEV_DB}" \
  -tc "SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'" \
  | grep -q 1 \
  || PGPASSWORD="${DB_PASS}" psql \
       -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DEV_DB}" \
       -c "CREATE DATABASE \"${TEST_DB}\""

echo "[setup-test-db] running migrations on ${TEST_DB}"
DATABASE_URL="${TEST_URL}" npx drizzle-kit push --config drizzle.config.ts 2>&1 | tail -3

echo "[setup-test-db] ready"
