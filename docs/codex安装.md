我的apikey是：ak_22d7Dc0V275g3ZL1kF4pY4A64uX4u

1. 安装 Codex ​
安装或更新 Node.js（v18.0 或更高版本）。

在终端中执行以下命令安装 Codex。

bash
npm install -g @openai/codex
执行以下命令验证安装。

bash
codex --version
2. 获取 LongCat APIKey ​
首先在 LongCat 开放平台 获取您的API Keys，并在用量信息页面中确认您账户内的Token额度充足。

LongCat API 开放平台目前提供以下模型：

模型名称	API格式	描述
LongCat-2.0	OpenAI/Anthropic	高性能Agentic模型
二、配置 LongCat API ​
1. 模型 ​
修改 ~/.codex/config.toml

toml
model_provider = "codex"
model = "LongCat-2.0"
disable_response_storage = true
web_search = "disabled"
model_reasoning_effort = "high"
model_supports_reasoning_summaries = true

[model_providers.codex]
name = "codex"
base_url = "https://api.longcat.chat/openai/v1"
wire_api = "responses"
requires_openai_auth = true
2. 授权 ​
修改 ~/.codex/auth.json

json
{
  "OPENAI_API_KEY": "<你的 LongCat API Key>"
}
其中 <你的 LongCat API Key> 在 LongCat 开放平台 获取。

三、使用 Codex ​
配置完成后，新建终端窗口，执行以下命令启动 Codex：

bash
codex
如果正常进入对话界面，那么可以开始正常使用 Codex + LongCat