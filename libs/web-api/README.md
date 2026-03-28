# DeepAgents Web API

HTTP REST API wrapper for DeepAgents SDK, enabling web frontends to use Agent capabilities through browser.

## 项目概述

DeepAgents Web API 将 DeepAgents SDK 的 Agent 能力封装为标准的 HTTP REST API，支持 Web 前端通过浏览器直接调用 Agent 功能。基于 FastAPI 构建，提供异步、高性能的 API 服务。

## 功能特性

- **会话管理**：创建、查询、删除 Agent 会话
- **流式执行**：通过 Server-Sent Events (SSE) 实时推送 Agent 执行状态
- **中断恢复**：支持人工审批流程，可中断和恢复 Agent 执行
- **文件系统隔离**：每个会话独立的文件系统工作区，防止越权访问
- **持久化存储**：基于 SQLite 的会话历史存储，支持断点续传

## 安装方法

### 从源码安装

```bash
cd libs/web-api
pip install -e .
```

### 开发模式安装

```bash
cd libs/web-api
pip install -e ".[dev]"
```

## 快速开始

### 1. 配置环境变量

创建 `.env` 文件：

```bash
# API 配置
API_HOST=0.0.0.0
API_PORT=8000

# Agent 配置
ANTHROPIC_API_KEY=your_api_key_here
MODEL_NAME=claude-3-5-sonnet-20241022

# 存储配置
SQLITE_DB_PATH=./data/sessions.db
WORKSPACE_ROOT=./workspaces
```

### 2. 启动服务

```bash
python -m deepagents_web_api.main
```

或使用 uvicorn：

```bash
uvicorn deepagents_web_api.main:app --host 0.0.0.0 --port 8000
```

### 3. 访问 API 文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 基本使用示例

```python
import httpx

# 创建会话
response = httpx.post("http://localhost:8000/sessions", json={
    "session_id": "my-session",
    "config": {"model": "claude-3-5-sonnet-20241022"}
})

# 运行 Agent
with httpx.stream("POST", "http://localhost:8000/sessions/my-session/run", json={
    "input": {"messages": [{"role": "user", "content": "Hello"}]}
}) as stream:
    for line in stream.iter_lines():
        if line.startswith("data: "):
            print(line[6:])
```

## API 文档

详细的 API 接口文档请访问：http://localhost:8000/docs

主要端点：
- `POST /sessions` - 创建会话
- `GET /sessions/{session_id}` - 查询会话
- `DELETE /sessions/{session_id}` - 删除会话
- `POST /sessions/{session_id}/run` - 运行 Agent (SSE)
- `POST /sessions/{session_id}/resume` - 恢复中断的执行
- `GET /sessions/{session_id}/state` - 获取会话状态

## 开发指南

### 运行测试

```bash
pytest tests/
```

### 代码格式化

```bash
ruff format .
```

### 代码检查

```bash
ruff check .
```

### 项目结构

```
libs/web-api/
├── deepagents_web_api/
│   ├── __init__.py       # 包初始化
│   ├── main.py           # FastAPI 应用入口
│   ├── models.py         # Pydantic 数据模型
│   ├── agent.py          # Agent 管理逻辑
│   └── streaming.py      # SSE 流式响应
└── tests/                # 测试用例
```

## 许可证

MIT License
