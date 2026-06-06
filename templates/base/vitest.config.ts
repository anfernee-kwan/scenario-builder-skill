import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // 测试库与开发库隔离：避免 resetDb() TRUNCATE 开发数据
    env: {
      DATABASE_URL: "postgres://clawlake:clawlake@127.0.0.1:{{host_port}}/{{db_name}}_test",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
