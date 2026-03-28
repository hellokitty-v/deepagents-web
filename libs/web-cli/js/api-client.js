/* HTTP API 客户端 - 封装所有 REST API 调用 */

class APIClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
        this.headers = config.headers;
    }

    async request(method, path, options = {}) {
        const url = this.baseURL + path;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const fetchOptions = {
                method,
                headers: { ...this.headers, ...options.headers },
                signal: controller.signal,
            };
            if (options.body) {
                fetchOptions.body = JSON.stringify(options.body);
            }
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw { status: response.status, detail: error.detail || response.statusText };
            }
            return response;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw { status: 0, detail: '请求超时' };
            }
            if (err.status) throw err;
            throw { status: 0, detail: '网络连接失败，请检查后端服务是否启动' };
        }
    }

    /* ====== 会话管理 ====== */

    async createSession(agentConfig) {
        const body = agentConfig ? { agent_config: agentConfig } : {};
        const resp = await this.request('POST', '/api/sessions', { body });
        return resp.json();
    }

    async listSessions(params = {}) {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        if (params.order_by) qs.set('order_by', params.order_by);
        if (params.order) qs.set('order', params.order);
        const query = qs.toString();
        const resp = await this.request('GET', '/api/sessions' + (query ? '?' + query : ''));
        return resp.json();
    }

    async getSessionHistory(threadId) {
        const resp = await this.request('GET', '/api/sessions/' + threadId);
        return resp.json();
    }

    async deleteSession(threadId) {
        const resp = await this.request('DELETE', '/api/sessions/' + threadId);
        return resp.json();
    }

    /* ====== 文件操作 ====== */

    async listFiles(threadId) {
        const resp = await this.request('GET', '/api/sessions/' + threadId + '/files');
        return resp.json();
    }

    getDownloadURL(fileId) {
        return this.baseURL + '/api/files/' + fileId + '/download';
    }

    getDownloadAllURL(threadId) {
        return this.baseURL + '/api/sessions/' + threadId + '/download-all';
    }

    async previewFile(fileId) {
        const resp = await this.request('GET', '/api/files/' + fileId + '/preview');
        return resp.json();
    }
}

window.apiClient = new APIClient(API_CONFIG);
