# Bob Plugin Bailian

阿里云百炼 DashScope 翻译插件，用百炼平台的大模型为 Bob 提供自定义翻译能力。

## 功能

- 支持 DashScope `text-generation/generation` 接口。
- 支持自定义模型，默认 `deepseek-v4-pro`。
- 支持 System Prompt 和 User Prompt。
- 支持 `$text`、`$sourceLang`、`$targetLang`、`$sourceCode`、`$targetCode` 变量。
- 支持 Bob 1.8.0+ 的流式输出。

## 安装

下载或导入仓库根目录的 `aliyun-bailian-translate.bobplugin`。

安装后在 Bob 插件设置里填写：

- `DashScope API Key`：阿里云百炼 / DashScope API Key。
- `模型`：例如 `deepseek-v4-pro`。
- `接口地址`：默认 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`。
- `System Prompt`：系统指令。
- `User Prompt`：用户指令。
- `启用模型思考`：默认关闭。打开后模型可能先生成推理内容，译文流式展示会等到接口开始返回 `content`。
- `流式输出`：默认开启。

插件设置中不提供额外“支持语言”配置。源语言和目标语言直接使用 Bob 翻译窗口的选择结果。

## Prompt 变量

System Prompt 和 User Prompt 都支持以下变量：

- `$text`：翻译窗口中的原文。
- `$sourceLang`：原文语言名称，例如 `简体中文`。
- `$targetLang`：目标语言名称，例如 `English`。
- `$sourceCode`：Bob 原文语言代码，例如 `zh-Hans`。
- `$targetCode`：Bob 目标语言代码，例如 `en`。

同时兼容全角 `＄text` 和 `{{text}}` 写法。

## 流式输出说明

插件使用 `$http.streamRequest` 发起 SSE 请求，并按 Bob 1.8.0+ 的流式回调方式调用：

```js
query.onStream({
  result: {
    from: query.detectFrom,
    to: query.detectTo,
    toParagraphs: [translatedText]
  }
});
```

这与 `bob-plugin-openai-translator` 的成熟实现保持一致。

## 打包

```sh
cd bob-plugin-bailian
zip -r ../aliyun-bailian-translate.bobplugin .
```

## 发布信息

- 当前版本：`0.2.0`
- 最低 Bob 版本：`1.8.0`
- 插件包：`aliyun-bailian-translate.bobplugin`
- SHA256：`e719f55aaaa9ec2f5e2045d911983c532b81ba4dc282449b569964bbd8d9a25e`

## 参考

- Bob 文本翻译插件文档：https://bobtranslate.com/plugin/quickstart/translate.html
- Bob 插件发布文档：https://bobtranslate.com/plugin/quickstart/publish.html
- 阿里云百炼 DashScope：https://dashscope.aliyuncs.com/
