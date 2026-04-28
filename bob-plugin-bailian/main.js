var DEFAULT_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
var DEFAULT_MODEL = "deepseek-v4-pro";
var DEFAULT_SYSTEM_PROMPT = "You are a translation engine. Translate accurately and output only the translation. Do not explain, summarize, or add information that is not in the source text.";
var DEFAULT_USER_PROMPT = "Translate from $sourceLang to $targetLang:\n\n$text";

var languageItems = [
    ["auto", "Auto"],
    ["zh-Hans", "简体中文"],
    ["zh-Hant", "繁體中文"],
    ["yue", "粤语"],
    ["wyw", "文言文"],
    ["en", "English"],
    ["ja", "Japanese"],
    ["ko", "Korean"],
    ["fr", "French"],
    ["de", "German"],
    ["es", "Spanish"],
    ["it", "Italian"],
    ["ru", "Russian"],
    ["pt", "Portuguese"],
    ["pt-pt", "Portuguese (Portugal)"],
    ["pt-br", "Portuguese (Brazil)"],
    ["nl", "Dutch"],
    ["pl", "Polish"],
    ["ar", "Arabic"],
    ["bg", "Bulgarian"],
    ["cs", "Czech"],
    ["da", "Danish"],
    ["el", "Greek"],
    ["et", "Estonian"],
    ["fi", "Finnish"],
    ["he", "Hebrew"],
    ["hi", "Hindi"],
    ["hr", "Croatian"],
    ["hu", "Hungarian"],
    ["id", "Indonesian"],
    ["ms", "Malay"],
    ["no", "Norwegian"],
    ["ro", "Romanian"],
    ["sk", "Slovak"],
    ["sl", "Slovenian"],
    ["sv", "Swedish"],
    ["sw", "Swahili"],
    ["th", "Thai"],
    ["tr", "Turkish"],
    ["uk", "Ukrainian"],
    ["vi", "Vietnamese"]
];

var languageNameMap = {};
for (var i = 0; i < languageItems.length; i += 1) {
    languageNameMap[languageItems[i][0]] = languageItems[i][1];
}

function supportLanguages() {
    var result = [];
    for (var i = 0; i < languageItems.length; i += 1) {
        result.push(languageItems[i][0]);
    }
    return result;
}

function pluginTimeoutInterval() {
    return 120;
}

function translate(query, completion) {
    var complete = createCompletion(query, completion);
    var apiKey = trimString($option.apiKey);

    if (!apiKey) {
        complete({
            error: createServiceError("secretKey", "请先在插件设置中填写 DashScope API Key。")
        });
        return;
    }

    var promptValues = createPromptValues(query);
    var systemPrompt = buildPrompt(getOptionValue("systemPrompt", DEFAULT_SYSTEM_PROMPT), promptValues, false);
    var userPrompt = buildPrompt(getOptionValue("prompt", DEFAULT_USER_PROMPT), promptValues, true);
    var body = createRequestBody(systemPrompt, userPrompt, isOptionEnabled($option.enableThinking, false));
    var useStream = isOptionEnabled($option.streamOutput, true) && $http && typeof $http.streamRequest === "function";

    if (useStream) {
        requestStreamTranslation(query, complete, apiKey, body);
    } else {
        requestTranslation(query, complete, apiKey, body);
    }
}

function pluginValidate(completion) {
    var apiKey = trimString($option.apiKey);

    if (!apiKey) {
        completion({
            result: false,
            error: createServiceError("secretKey", "请先填写 DashScope API Key。")
        });
        return;
    }

    var body = createRequestBody("", "请只回复 OK。", false);
    body.parameters.incremental_output = false;

    $http.request({
        method: "POST",
        url: getEndpoint(),
        header: createHeaders(apiKey, false),
        body: body,
        timeout: 30,
        handler: function(resp) {
            var serviceError = parseHttpError(resp);
            if (serviceError) {
                completion({
                    result: false,
                    error: serviceError
                });
                return;
            }

            var output = parseDashScopeOutput(resp.data);
            if (!output.text) {
                completion({
                    result: false,
                    error: createServiceError("api", "验证失败：接口没有返回有效内容。", stringifyForDebug(resp.data))
                });
                return;
            }

            completion({
                result: true
            });
        }
    });
}

function requestTranslation(query, complete, apiKey, body) {
    body.parameters.incremental_output = false;

    $http.request({
        method: "POST",
        url: getEndpoint(),
        header: createHeaders(apiKey, false),
        body: body,
        timeout: pluginTimeoutInterval(),
        cancelSignal: query.cancelSignal,
        handler: function(resp) {
            var serviceError = parseHttpError(resp);
            if (serviceError) {
                complete({
                    error: serviceError
                });
                return;
            }

            var output = parseDashScopeOutput(resp.data);
            if (!output.text) {
                complete({
                    error: createServiceError("api", "百炼接口没有返回翻译结果。", stringifyForDebug(resp.data))
                });
                return;
            }

            complete({
                result: createTranslateResult(query, output.text, resp.data)
            });
        }
    });
}

function requestStreamTranslation(query, complete, apiKey, body) {
    body.parameters.incremental_output = true;

    var translatedText = "";
    var rawStreamText = "";
    var streamError = null;
    var parser = createSSEParser(function(data) {
        var apiError = parseDashScopeDataError(data);
        if (apiError) {
            streamError = apiError;
            return;
        }

        var output = parseDashScopeOutput(data);
        if (!output.text) {
            return;
        }

        translatedText += output.text;
        emitStream(query, translatedText);
    });

    $http.streamRequest({
        method: "POST",
        url: getEndpoint(),
        header: createHeaders(apiKey, true),
        body: body,
        timeout: pluginTimeoutInterval(),
        cancelSignal: query.cancelSignal,
        streamHandler: function(stream) {
            if (!stream.text) {
                return;
            }

            rawStreamText += stream.text;
            parser.feed(stream.text);
        },
        handler: function(resp) {
            parser.flush();

            if (streamError) {
                complete({
                    error: streamError
                });
                return;
            }

            var serviceError = parseHttpError(resp);
            if (serviceError) {
                complete({
                    error: serviceError
                });
                return;
            }

            if (!translatedText) {
                var fallback = parseRawStreamText(rawStreamText);
                translatedText = fallback.text;
            }

            if (!translatedText) {
                complete({
                    error: createServiceError("api", "百炼接口没有返回翻译结果。", rawStreamText)
                });
                return;
            }

            complete({
                result: createTranslateResult(query, translatedText)
            });
        }
    });
}

function createRequestBody(systemPrompt, userPrompt, enableThinking) {
    var messages = [];

    if (trimString(systemPrompt)) {
        messages.push({
            role: "system",
            content: systemPrompt
        });
    }

    messages.push({
        role: "user",
        content: userPrompt
    });

    return {
        model: getOptionValue("model", DEFAULT_MODEL),
        input: {
            messages: messages
        },
        parameters: {
            enable_thinking: enableThinking,
            incremental_output: true,
            result_format: "message"
        }
    };
}

function createHeaders(apiKey, stream) {
    var headers = {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
    };

    if (stream) {
        headers["X-DashScope-SSE"] = "enable";
    }

    return headers;
}

function createTranslateResult(query, text, raw) {
    var result = {
        from: query.detectFrom || query.from,
        to: query.detectTo || query.to,
        toParagraphs: [trimTrailingNewlines(text)]
    };

    if (raw) {
        result.raw = raw;
    }

    return result;
}

function emitStream(query, text) {
    if (!query || typeof query.onStream !== "function" || !text) {
        return;
    }

    query.onStream({
        result: createTranslateResult(query, text)
    });
}

function parseDashScopeOutput(data) {
    var empty = {
        text: "",
        reasoning: ""
    };

    if (!data) {
        return empty;
    }

    if (data.output && data.output.choices && data.output.choices.length > 0) {
        var message = data.output.choices[0].message || {};
        return {
            text: normalizeContent(message.content),
            reasoning: normalizeContent(message.reasoning_content)
        };
    }

    if (data.output && data.output.text) {
        return {
            text: normalizeContent(data.output.text),
            reasoning: normalizeContent(data.output.reasoning_content)
        };
    }

    if (data.text) {
        return {
            text: normalizeContent(data.text),
            reasoning: normalizeContent(data.reasoning_content)
        };
    }

    return empty;
}

function normalizeContent(content) {
    if (!content) {
        return "";
    }

    if (typeof content === "string") {
        return content;
    }

    if (content instanceof Array) {
        var textParts = [];
        for (var i = 0; i < content.length; i += 1) {
            if (typeof content[i] === "string") {
                textParts.push(content[i]);
            } else if (content[i] && typeof content[i].text === "string") {
                textParts.push(content[i].text);
            }
        }
        return textParts.join("");
    }

    return "";
}

function createSSEParser(onData) {
    var buffer = "";

    return {
        feed: function(chunk) {
            buffer += chunk;
            var events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop();

            for (var i = 0; i < events.length; i += 1) {
                parseSSEEvent(events[i], onData);
            }
        },
        flush: function() {
            if (buffer) {
                parseSSEEvent(buffer, onData);
                buffer = "";
            }
        }
    };
}

function parseSSEEvent(eventText, onData) {
    var lines = eventText.split(/\r?\n/);
    var dataLines = [];

    for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        if (line.indexOf("data:") === 0) {
            dataLines.push(trimString(line.slice(5)));
        }
    }

    if (dataLines.length > 0) {
        parseDataText(dataLines.join("\n"), onData);
        return;
    }

    parseDataText(trimString(eventText), onData);
}

function parseDataText(dataText, onData) {
    if (!dataText || dataText === "[DONE]" || dataText.indexOf("[DONE]") === 0) {
        return;
    }

    try {
        onData(JSON.parse(dataText));
    } catch (error) {
        $log.error("DashScope SSE parse failed: " + error.message + "\n" + dataText);
    }
}

function parseRawStreamText(rawText) {
    var result = {
        text: "",
        reasoning: ""
    };

    if (!rawText) {
        return result;
    }

    try {
        return parseDashScopeOutput(JSON.parse(rawText));
    } catch (error) {
        return result;
    }
}

function parseHttpError(resp) {
    if (!resp) {
        return createServiceError("network", "网络请求失败：没有收到响应。");
    }

    if (resp.error) {
        return createServiceError("network", getNetworkErrorMessage(resp.error), stringifyForDebug(resp.error));
    }

    var statusCode = resp.response && resp.response.statusCode;
    if (statusCode && (statusCode < 200 || statusCode >= 300)) {
        return createServiceError("network", "百炼接口请求失败，HTTP 状态码：" + statusCode, stringifyForDebug({
            statusCode: statusCode,
            data: resp.data
        }));
    }

    return parseDashScopeDataError(resp.data);
}

function parseDashScopeDataError(data) {
    if (data && data.code && data.message) {
        return createServiceError("api", data.message, stringifyForDebug(data));
    }

    return null;
}

function getNetworkErrorMessage(error) {
    return error.message || error.localizedDescription || "网络请求失败。";
}

function createServiceError(type, message, addition) {
    var error = {
        type: type,
        message: message
    };

    if (addition) {
        error.addition = addition;
    }

    return error;
}

function createCompletion(query, completion) {
    var finished = false;

    return function(payload) {
        if (finished) {
            return;
        }
        finished = true;

        if (query && typeof query.onCompletion === "function") {
            query.onCompletion(payload);
        } else if (typeof completion === "function") {
            completion(payload);
        }
    };
}

function createPromptValues(query) {
    var sourceCode = query.detectFrom || query.from || "";
    var targetCode = query.detectTo || query.to || "";

    return {
        text: query.text || "",
        sourceLang: getLanguageName(sourceCode, "自动检测语言"),
        targetLang: getLanguageName(targetCode, "目标语言"),
        sourceCode: sourceCode,
        targetCode: targetCode
    };
}

function buildPrompt(template, values, appendTextWhenMissing) {
    var prompt = (template || "").split("\\n").join("\n");
    if (!prompt) {
        prompt = appendTextWhenMissing ? DEFAULT_USER_PROMPT : DEFAULT_SYSTEM_PROMPT;
    }

    var hasTextPlaceholder = containsAny(prompt, ["$text", "＄text", "{{text}}"]);

    prompt = replaceToken(prompt, "text", values.text);
    prompt = replaceToken(prompt, "sourceLang", values.sourceLang);
    prompt = replaceToken(prompt, "targetLang", values.targetLang);
    prompt = replaceToken(prompt, "sourceCode", values.sourceCode);
    prompt = replaceToken(prompt, "targetCode", values.targetCode);

    if (appendTextWhenMissing && !hasTextPlaceholder) {
        prompt += "\n\n" + values.text;
    }

    return prompt;
}

function replaceToken(text, token, value) {
    var result = text;
    var normalizedValue = value === undefined || value === null ? "" : String(value);
    var patterns = ["$" + token, "＄" + token, "{{" + token + "}}"];

    for (var i = 0; i < patterns.length; i += 1) {
        result = result.split(patterns[i]).join(normalizedValue);
    }

    return result;
}

function containsAny(text, patterns) {
    for (var i = 0; i < patterns.length; i += 1) {
        if (text.indexOf(patterns[i]) >= 0) {
            return true;
        }
    }
    return false;
}

function getLanguageName(code, fallback) {
    if (!code || code === "auto") {
        return fallback || "Auto";
    }

    return languageNameMap[code] || code;
}

function getEndpoint() {
    return getOptionValue("endpoint", DEFAULT_ENDPOINT);
}

function getOptionValue(identifier, fallback) {
    var value = trimString($option[identifier]);
    return value || fallback;
}

function isOptionEnabled(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return value === true || value === "true" || value === "1" || value === "enable";
}

function trimString(value) {
    if (value === undefined || value === null) {
        return "";
    }
    return String(value).replace(/^\s+|\s+$/g, "");
}

function trimTrailingNewlines(text) {
    return String(text || "").replace(/\s+$/g, "");
}

function stringifyForDebug(value) {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
}
