/* SSE 流式客户端 - 处理 Agent 任务执行和中断恢复 */

class SSEClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.abortController = null;
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    async runTask(threadId, message, callbacks) {
        this.abort();
        this.abortController = new AbortController();

        const url = this.baseURL + '/api/sessions/' + threadId + '/run';
        await this._streamRequest(url, { message }, callbacks);
    }

    async resumeTask(threadId, decisions, callbacks) {
        this.abort();
        this.abortController = new AbortController();

        const url = this.baseURL + '/api/sessions/' + threadId + '/resume';
        await this._streamRequest(url, { decisions }, callbacks);
    }

    async _streamRequest(url, body, callbacks) {
        const cb = callbacks || {};
        this._endReceived = false;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: this.abortController ? this.abortController.signal : undefined,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: response.statusText }));
                if (cb.onError) cb.onError(err.detail || 'Request failed');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (!raw) continue;

                    try {
                        const evt = JSON.parse(raw);
                        this._dispatch(evt, cb);
                    } catch (e) {
                        console.warn('SSE parse error:', e, raw);
                    }
                }
            }

            // Process remaining buffer
            if (buffer.startsWith('data: ')) {
                try {
                    const evt = JSON.parse(buffer.slice(6).trim());
                    this._dispatch(evt, cb);
                } catch (e) { /* ignore */ }
            }

            // onEnd is dispatched via _dispatch when 'end' event arrives
            // Only call here if no 'end' event was received (connection closed)
            if (!this._endReceived && cb.onEnd) cb.onEnd();
        } catch (err) {
            if (err.name === 'AbortError') {
                if (cb.onAbort) cb.onAbort();
                return;
            }
            if (cb.onError) cb.onError(err.message || '连接失败');
        }
    }

    _dispatch(evt, cb) {
        const type = evt.event || evt.type;
        const data = evt.data || evt;

        switch (type) {
            case 'messages':
                if (cb.onMessage) cb.onMessage(data);
                break;
            case 'tool_calls':
                if (cb.onToolCall) cb.onToolCall(data);
                break;
            case 'tool_result':
                if (cb.onToolResult) cb.onToolResult(data);
                break;
            case 'interrupt':
                if (cb.onInterrupt) cb.onInterrupt(data);
                break;
            case 'updates':
                if (cb.onUpdate) cb.onUpdate(data);
                break;
            case 'end':
                this._endReceived = true;
                if (cb.onEnd) cb.onEnd();
                break;
            case 'error':
                if (cb.onError) cb.onError(data.message || data);
                break;
            default:
                console.log('Unknown SSE event:', type, data);
        }
    }
}

window.sseClient = new SSEClient(API_CONFIG);
