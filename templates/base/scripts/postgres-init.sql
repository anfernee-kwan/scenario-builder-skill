-- postgres-init.sql
-- Docker 容器首次启动时自动创建测试库，确保 npm test 不污染开发库。
-- 此文件由 docker-compose.yml 挂载到 /docker-entrypoint-initdb.d/
-- 注意：Handlebars 渲染时 {{db_name}} 会被替换为实际库名。
CREATE DATABASE {{db_name}}_test;
