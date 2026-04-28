# Bob Plugin Bailian

Alibaba Cloud Bailian DashScope translation plugin, providing custom translation capabilities for Bob using large models from the Bailian platform.

## Features

- Supports DashScope `text-generation/generation` interface.
- Supports custom models, default is `deepseek-v4-pro`.
- Supports temperature setting, default is `0.2`.
- Supports System Prompt and User Prompt.
- Supports `$text`, `$sourceLang`, `$targetLang`, `$sourceCode`, `$targetCode` variables.
- Supports streaming output for Bob 1.8.0+.

## Installation

Download or import `aliyun-bailian-translate.bobplugin` from the repository root.

After installation, fill in the following in Bob's plugin settings:

- `DashScope API Key`: Alibaba Cloud Bailian / DashScope API Key.
- `Model`: e.g., `deepseek-v4-pro`.
- `Temperature`: Controls output randomness, range `0` to `2`, default is `0.2`.
- `API Endpoint`: Default is `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`.
- `System Prompt`: System instructions.
- `User Prompt`: User instructions.
- `Enable Model Reasoning`: Disabled by default. When enabled, the model may generate reasoning content first; streaming display of the translation will wait until the interface starts returning `content`.
- `Streaming Output`: Enabled by default.

Extra "Supported Languages" configuration is not provided in the plugin settings. The source and target languages are directly taken from the selection in the Bob translation window.

## Prompt Variables

Both System Prompt and User Prompt support the following variables:

- `$text`: The original text in the translation window.
- `$sourceLang`: Source language name, e.g., `Simplified Chinese`.
- `$targetLang`: Target language name, e.g., `English`.
- `$sourceCode`: Bob source language code, e.g., `zh-Hans`.
- `$targetCode`: Bob target language code, e.g., `en`.

Also compatible with full-width `＄text` and `{{text}}` syntax.

## Streaming Output Description

The plugin uses `$http.streamRequest` to initiate SSE requests and calls back in the streaming manner of Bob 1.8.0+:

```js
query.onStream({
  result: {
    from: query.detectFrom,
    to: query.detectTo,
    toParagraphs: [translatedText]
  }
});
```

This is consistent with the mature implementation of `bob-plugin-openai-translator`.

## Packaging

```sh
cd bob-plugin-bailian
zip -r ../aliyun-bailian-translate.bobplugin .
```

## Release Information

- Current Version: `0.2.1`
- Minimum Bob Version: `1.8.0`
- Plugin Package: `aliyun-bailian-translate.bobplugin`
- SHA256: `92e9e30c72b5c010814bf7a84e889ef885600012670512f1ed52c7e81f5d391c`

## References

- Bob Text Translation Plugin Documentation: https://bobtranslate.com/plugin/quickstart/translate.html
- Bob Plugin Publishing Documentation: https://bobtranslate.com/plugin/quickstart/publish.html
- Alibaba Cloud Bailian DashScope: https://dashscope.aliyuncs.com/
