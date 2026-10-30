# Lia Workcenter

Lia 的本地达人合作工作中心。中文界面、单人使用，数据保存在本机 SQLite 数据库中。

## 开发运行

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。后端健康检查位于 `http://localhost:8787/api/health`。

## 常用命令

- `npm run dev`：同时启动前端和后端
- `npm run build`：构建前后端
- `npm test`：运行测试

本地数据库保存在 `data/lia-workbench.db`，不会提交到 Git。
