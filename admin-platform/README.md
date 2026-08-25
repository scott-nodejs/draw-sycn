# 笔尖云堂管理后台

此目录是与老师端、学生端、Teacher Agent、内容整理端隔离的后台管理系统。

## 第一阶段范围

- 登录、验证码、会话与权限认证
- 租户管理、租户套餐管理、租户数据隔离
- 用户、角色、菜单、部门、岗位管理
- 字典、参数、通知公告、操作日志、登录日志

暂不接入商城、工作流、任务调度、代码生成、AI 示例和产品业务模块。

## 技术基线

- 后端：Dromara RuoYi-Vue-Plus 5.X，Java 17、Spring Boot、Sa-Token、MyBatis-Plus
- 前端：CrazyLionCat plus-ui 5.X，Vue 3、TypeScript、Element Plus、Vite
- 数据：MySQL、Redis
- 上游源码保留原 MIT License

## 目录

```text
admin-platform/
├── backend/  # 管理后台 API
└── web/      # 管理后台 Web
```

## 本地启动基线

1. 创建 MySQL 数据库并导入 `backend/script/sql/bijian_admin.sql`。该脚本只保留系统管理与租户管理所需数据。
2. 复制 `backend/.env.example` 为 `backend/.env`，配置 MySQL 和 Redis。敏感信息不写入 YAML。
3. 使用 Java 17 执行 `mvn -pl ruoyi-admin -am clean package -DskipTests`，Linux 下通过 `backend/start.sh` 启动。
4. 使用 Node 20+、pnpm 10+ 在 `web` 中执行 `pnpm install && pnpm dev`。

第二阶段将在此后台增加笔尖云堂的产品、老师、学生、题库、订单与 Teacher Agent 运营模块。
