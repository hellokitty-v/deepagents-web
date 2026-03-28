/* 任务执行核心：状态管理、UI组件、消息构建、API集成 */
let taskRunning = false;
let taskTimers = [];
let currentThreadId = null;

function stopTask() {
    taskRunning = false;
    taskTimers.forEach(t => clearTimeout(t));
    taskTimers = [];
    if (window.sseClient) sseClient.abort();
}

function delay(ms) {
    return new Promise(resolve => { const t = setTimeout(resolve, ms); taskTimers.push(t); });
}

function scrollToBottom() {
    const b = document.getElementById('conversationBody');
    if (b) b.scrollTop = b.scrollHeight;
}

function addUserMessage(text) {
    const c = document.getElementById('conversationBody');
    const d = document.createElement('div');
    d.className = 'message user-message';
    d.innerHTML = '<div class="message-avatar"><i class="fas fa-user"></i></div>' +
        '<div class="message-content"><div class="message-text">' + text + '</div></div>';
    c.appendChild(d);
    scrollToBottom();
}

function addAgentMessage() {
    const c = document.getElementById('conversationBody');
    const d = document.createElement('div');
    d.className = 'message agent-message';
    const mc = document.createElement('div');
    mc.className = 'message-content';
    d.innerHTML = '<div class="message-avatar"><i class="fas fa-robot"></i></div>';
    d.appendChild(mc);
    c.appendChild(d);
    scrollToBottom();
    return mc;
}

async function typeText(el, text, speed) {
    speed = speed || 25;
    for (let i = 0; i < text.length; i++) {
        if (!taskRunning) return;
        el.textContent += text[i];
        scrollToBottom();
        await delay(speed);
    }
}

function addTextBlock(container, html) {
    const d = document.createElement('div');
    d.className = 'agent-text';
    d.innerHTML = html;
    container.appendChild(d);
    scrollToBottom();
}

/* 工具调用的图标和描述映射 */
function getToolDisplay(name, args) {
    var a = args || {};
    switch (name) {
        case 'write_file':
            return { icon: 'file-pen', label: '写入文件', detail: a.path || '' };
        case 'read_file':
            return { icon: 'file-lines', label: '读取文件', detail: a.path || '' };
        case 'edit_file':
            return { icon: 'file-pen', label: '编辑文件', detail: a.path || '' };
        case 'execute':
            return { icon: 'terminal', label: '执行命令', detail: (a.command || '').substring(0, 60) };
        case 'task':
            return { icon: 'users', label: '委派子任务', detail: a.task || '' };
        case 'glob':
            return { icon: 'search', label: '搜索文件', detail: a.pattern || '' };
        case 'grep':
            return { icon: 'search', label: '搜索内容', detail: a.pattern || '' };
        case 'ls':
            return { icon: 'folder-open', label: '列出目录', detail: a.path || '' };
        case 'write_todos':
            return { icon: 'list-check', label: '创建任务列表', detail: '' };
        default:
            return { icon: 'gear', label: name, detail: '' };
    }
}

function addToolStep(container, name, args) {
    // Remove active from previous steps
    container.querySelectorAll('.step-item-inline.active').forEach(function(el) {
        el.classList.remove('active');
    });
    var t = getToolDisplay(name, args);
    var detail = t.detail ? '<span class="step-detail">' + t.detail + '</span>' : '';
    var s = document.createElement('div');
    s.className = 'step-item-inline active';
    s.innerHTML = '<div class="step-icon loading"></div>' +
        '<div class="step-text"><i class="fas fa-' + t.icon + '" style="margin-right:6px;color:var(--primary-color);"></i>' +
        t.label + detail + '</div>';
    container.appendChild(s);
    scrollToBottom();
}

function completeLastToolStep(container, data) {
    var steps = container.querySelectorAll('.step-item-inline .step-icon.loading');
    if (steps.length > 0) {
        var last = steps[steps.length - 1];
        last.classList.remove('loading');
        last.innerHTML = '<i class="fas fa-check" style="font-size:10px;color:var(--success-color);"></i>';
        // Remove active state
        var stepItem = last.closest('.step-item-inline');
        if (stepItem) stepItem.classList.remove('active');
        // Update step detail from tool_result content
        if (data && data.content) {
            var stepText = last.parentElement.querySelector('.step-text');
            if (stepText && !stepText.querySelector('.step-detail')) {
                var detail = data.content;
                if (detail.length > 80) detail = detail.substring(0, 80) + '...';
                stepText.innerHTML += ' <span class="step-detail">' + detail + '</span>';
            }
        }
    }
}

/* 沙箱预览集成：根据工具调用更新右侧沙箱面板 */
var _sandboxOpened = false;
var _sandboxStepCount = 0;
var _sandboxFiles = [];

function initSandboxForTask() {
    _sandboxOpened = false;
    _sandboxStepCount = 0;
    _sandboxFiles = [];
}

function ensureSandboxOpen() {
    if (!_sandboxOpened) {
        openSandbox();
        setSandboxToolbar([
            { id: 'editor', icon: 'code', label: '编辑器' },
            { id: 'terminal', icon: 'terminal', label: '终端' },
            { id: 'preview', icon: 'eye', label: '预览' }
        ], 'editor');
        setSandboxStatus('运行中', true);
        showEditorView();
        _sandboxOpened = true;
    }
}

function sandboxOnToolCall(name, args) {
    ensureSandboxOpen();
    _sandboxStepCount++;

    if (name === 'execute' || name === 'bash' || name === 'shell_exec') {
        switchSandboxView('terminal');
        var cmd = (args && args.command) || (args && args.cmd) || name;
        addTerminalLine('cmd', '$ ' + cmd);
    } else if (name === 'write_file' || name === 'edit_file' || name === 'read_file') {
        switchSandboxView('editor');
        var path = (args && (args.path || args.file_path)) || '';
        if (path) {
            var fname = path.split('/').pop();
            var ext = fname.split('.').pop();
            var iconMap = { py: 'file-code', js: 'file-code', html: 'file-code', css: 'file-code',
                           md: 'file-alt', txt: 'file-alt', json: 'file-code', pptx: 'file-powerpoint' };
            setEditorFile(fname, iconMap[ext] || 'file-code');

            // Add to file tree if new
            if (!_sandboxFiles.find(function(f) { return f.name === fname; })) {
                _sandboxFiles.push({ name: fname, icon: iconMap[ext] || 'file' });
                sandboxState.files = _sandboxFiles;
                renderFileTree();
            }

            // Show file content immediately if available in args
            if (name === 'write_file' && args && args.content) {
                var lines = args.content.split('\n').slice(0, 100).map(function(l) { return { text: l }; });
                setEditorContent(lines);
            }
        }
    }

    setSandboxProgress(_sandboxStepCount, _sandboxStepCount + 2, '步骤 ' + _sandboxStepCount);
}

function sandboxOnToolResult(name, data) {
    if (!_sandboxOpened) return;

    var content = (data && data.content) || '';

    if (name === 'execute' || name === 'bash' || name === 'shell_exec') {
        // Show command output in terminal
        if (content) addTerminalLine('output', escHtml(content));
    } else if (name === 'write_file' || name === 'edit_file') {
        // Extract file path from result message (e.g., "Updated file /index.html")
        var pathMatch = content.match(/file\s+(\/[^\s]+)/i);
        if (pathMatch) {
            var filePath = pathMatch[1];
            var fname = filePath.split('/').pop();

            // Update file tree
            if (!_sandboxFiles.find(function(f) { return f.name === fname; })) {
                var ext = fname.split('.').pop();
                var iconMap = { py: 'file-code', js: 'file-code', html: 'file-code', css: 'file-code',
                               md: 'file-alt', txt: 'file-alt', json: 'file-code', pptx: 'file-powerpoint' };
                _sandboxFiles.push({ name: fname, icon: iconMap[ext] || 'file' });
                sandboxState.files = _sandboxFiles;
                renderFileTree();
            }

            // Load and display file content
            loadFileContent(fname);
        }
    } else if (name === 'read_file') {
        // Show read content in editor
        if (content) {
            var lines = content.split('\n').slice(0, 100).map(function(l) { return { text: l }; });
            setEditorContent(lines);
        }
    }

    setSandboxProgress(_sandboxStepCount, _sandboxStepCount + 1, '步骤 ' + _sandboxStepCount + ' 完成');
}

function sandboxOnEnd() {
    if (_sandboxOpened) {
        setSandboxStatus('已完成', false);
        setSandboxProgress(_sandboxStepCount, _sandboxStepCount, '全部完成');
    }
}

/* Load and display file content by filename */
function loadFileContent(filename) {
    if (!currentThreadId) {
        console.warn('[Sandbox] No currentThreadId available');
        return;
    }

    console.log('[Sandbox] Loading file:', filename);
    setEditorFile(filename);

    fetch(apiClient.baseURL + '/api/sessions/' + currentThreadId + '/files')
        .then(function(r) { return r.json(); })
        .then(function(result) {
            var file = result.files.find(function(f) { return f.name === filename; });
            if (file) {
                console.log('[Sandbox] Found file:', file.file_id);
                return fetch(apiClient.baseURL + '/api/files/' + file.file_id + '/download');
            } else {
                console.warn('[Sandbox] File not found:', filename);
                throw new Error('File not found');
            }
        })
        .then(function(r) { return r.text(); })
        .then(function(text) {
            console.log('[Sandbox] Loaded file content, length:', text.length);
            var lines = text.split('\n').slice(0, 100).map(function(l) { return { text: l }; });
            setEditorContent(lines);
        })
        .catch(function(e) {
            console.error('[Sandbox] Failed to load file:', e);
            setEditorContent([{ text: '// 加载文件失败: ' + e.message }]);
        });
}

/* 创建 SSE 回调对象（复用于 startTask / sendFollowUp / resumeTask） */
function createSSECallbacks(mc, opts) {
    var o = opts || {};
    return {
        onMessage: function(data) {
            if (data.content) {
                var block = getOrCreateStreamBlock(mc);
                block.textContent += data.content;
                scrollToBottom();
            }
        },
        onToolCall: function(data) {
            closeStreamBlock(mc);
            var name = data.tool_name || data.name || 'tool';
            var args = data.args || {};
            addToolStep(mc, name, args);
            sandboxOnToolCall(name, args);
        },
        onToolResult: function(data) {
            closeStreamBlock(mc);
            completeLastToolStep(mc, data);
            var name = data.tool_name || data.name || '';
            sandboxOnToolResult(name, data);
        },
        onInterrupt: function(data) {
            showInterruptDialog(mc, data);
        },
        onEnd: function() {
            closeStreamBlock(mc);
            sandboxOnEnd();
            if (o.onEnd) o.onEnd();
        },
        onError: o.onError || function(msg) {
            closeStreamBlock(mc);
            addTextBlock(mc, '<span style="color:red;">执行出错: ' + msg + '</span>');
        },
        onAbort: o.onAbort || function() {
            closeStreamBlock(mc);
            addTextBlock(mc, '<span style="color:orange;">任务已停止</span>');
        }
    };
}
function getOrCreateStreamBlock(container) {
    var last = container.querySelector('.agent-text-stream:last-of-type');
    if (last && !last.dataset.closed) return last;
    var d = document.createElement('div');
    d.className = 'agent-text agent-text-stream';
    container.appendChild(d);
    scrollToBottom();
    return d;
}

function closeStreamBlock(container) {
    var blocks = container.querySelectorAll('.agent-text-stream');
    blocks.forEach(function(b) {
        if (!b.dataset.closed) {
            b.dataset.closed = '1';
            // Render accumulated text as Markdown
            var raw = b.textContent;
            if (raw && typeof marked !== 'undefined') {
                b.innerHTML = marked.parse(raw);
                b.classList.add('markdown-body');
            }
        }
    });
}

async function addThinkingBlock(container, text) {
    const s = document.createElement('div');
    s.className = 'thinking-section';
    s.innerHTML = '<div class="thinking-header"><i class="fas fa-brain"></i><span>思考中...</span></div>' +
        '<div class="thinking-content"></div>';
    container.appendChild(s);
    scrollToBottom();
    await typeText(s.querySelector('.thinking-content'), text, 18);
    s.querySelector('.thinking-header span').textContent = '思考完成';
}

async function addStepBlock(container, title) {
    const s = document.createElement('div');
    s.className = 'step-section';
    s.innerHTML = '<div class="step-section-header"><i class="fas fa-tasks"></i><span>' + title + '</span></div>' +
        '<div class="step-section-body"></div>';
    container.appendChild(s);
    scrollToBottom();
    return s.querySelector('.step-section-body');
}

async function addActionStep(body, icon, text, dur) {
    dur = dur || 1000;
    const s = document.createElement('div');
    s.className = 'step-item-inline';
    s.innerHTML = '<div class="step-icon loading"><i class="fas fa-spinner fa-spin" style="font-size:10px"></i></div>' +
        '<div class="step-text">' + text + '</div>';
    body.appendChild(s);
    scrollToBottom();
    await delay(dur);
    if (!taskRunning) return;
    s.querySelector('.step-icon').classList.remove('loading');
    s.querySelector('.step-icon').innerHTML = '<i class="fas fa-' + icon + '" style="font-size:10px"></i>';
}

function addFileChips(container, files) {
    const sec = document.createElement('div');
    sec.className = 'file-section';
    files.forEach(f => {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.onclick = () => previewFile(f.name, f.type);
        chip.innerHTML = '<i class="fas fa-' + f.icon + '"></i><span>' + f.name + '</span>';
        sec.appendChild(chip);
    });
    container.appendChild(sec);
    scrollToBottom();
}

function addCompletionBlock(container, files) {
    const s = document.createElement('div');
    s.className = 'completion-section';
    let fh = files.map(f =>
        '<div class="file-chip" style="background:white;cursor:pointer;" onclick="previewFile(\'' +
        f.name + "','" + f.type + "')\">" + '<i class="fas fa-' + f.icon + '"></i><span>' + f.name +
        '</span><i class="fas fa-download" style="margin-left:8px;color:var(--primary-color);"></i></div>'
    ).join('');
    s.innerHTML = '<i class="fas fa-check-circle"></i><h4>任务完成</h4>' +
        '<p>所有文件已生成完毕，可以下载或在线预览</p>' +
        '<div class="file-section" style="justify-content:center;margin-bottom:16px;">' + fh + '</div>' +
        '<div class="completion-actions">' +
        '<button class="btn-primary" onclick="downloadFiles()"><i class="fas fa-download"></i> 打包下载</button>' +
        '<button class="btn-secondary" onclick="backToHome()">返回首页</button></div>';
    container.appendChild(s);
    scrollToBottom();
}

function markTaskComplete() {
    taskRunning = false;
    const b = document.getElementById('taskStatusBadge');
    b.innerHTML = '<i class="fas fa-check-circle"></i><span>已完成</span>';
    b.className = 'task-status-badge badge-success';
    document.getElementById('btnStop').style.display = 'none';
    const ci = document.getElementById('chatInput');
    ci.disabled = false;
    ci.placeholder = '对结果有疑问？继续对话...';
    document.getElementById('btnSend').disabled = false;
}

/* ====== API 集成：真实任务执行 ====== */

function downloadFiles() {
    if (!currentThreadId) {
        alert('没有可下载的文件');
        return;
    }
    window.open(apiClient.getDownloadAllURL(currentThreadId), '_blank');
}

async function sendFollowUp() {
    const inp = document.getElementById('chatInput');
    const msg = inp.value.trim();
    if (!msg || !currentThreadId) return;

    inp.value = '';
    inp.disabled = true;
    document.getElementById('btnSend').disabled = true;
    addUserMessage(msg);

    const mc = addAgentMessage();
    taskRunning = true;

    await sseClient.runTask(currentThreadId, msg, createSSECallbacks(mc, {
        onEnd: function() {
            taskRunning = false;
            inp.disabled = false;
            document.getElementById('btnSend').disabled = false;
        },
        onError: function(msg) {
            addTextBlock(mc, '<span style="color:red;">错误: ' + msg + '</span>');
            inp.disabled = false;
            document.getElementById('btnSend').disabled = false;
        }
    }));
}

function showInterruptDialog(container, data) {
    const s = document.createElement('div');
    s.className = 'interrupt-section';
    s.innerHTML = '<div class="interrupt-header"><i class="fas fa-pause-circle"></i> 需要审批</div>' +
        '<div class="interrupt-body"><p>Agent 请求执行以下操作，请审批：</p>' +
        '<pre>' + JSON.stringify(data, null, 2) + '</pre></div>' +
        '<div class="interrupt-actions">' +
        '<button class="btn-primary" onclick="resumeTask(\'approve\', this)"><i class="fas fa-check"></i> 批准</button>' +
        '<button class="btn-secondary" onclick="resumeTask(\'reject\', this)"><i class="fas fa-times"></i> 拒绝</button></div>';
    container.appendChild(s);
    scrollToBottom();
}

async function resumeTask(decision, btn) {
    if (!currentThreadId) return;
    const section = btn.closest('.interrupt-section');
    if (section) {
        section.querySelector('.interrupt-actions').innerHTML =
            '<span style="color:var(--primary-color);">' +
            (decision === 'approve' ? '✓ 已批准' : '✗ 已拒绝') + '</span>';
    }

    const mc = addAgentMessage();
    taskRunning = true;

    await sseClient.resumeTask(currentThreadId, [{ type: decision }], createSSECallbacks(mc, {
        onEnd: async function() {
            await loadSessionFiles(mc);
            markTaskComplete();
        },
        onError: function(msg) {
            addTextBlock(mc, '<span style="color:red;">错误: ' + msg + '</span>');
        }
    }));
}

async function loadSessionFiles(container) {
    if (!currentThreadId) return;
    try {
        const result = await apiClient.listFiles(currentThreadId);
        if (result.files && result.files.length > 0) {
            const files = result.files.map(f => ({
                name: f.name,
                type: f.path.split('.').pop() || 'file',
                icon: getFileIcon(f.name),
                file_id: f.file_id,
            }));
            addCompletionBlock(container, files);
        }
    } catch (e) {
        console.warn('Failed to load session files:', e);
    }
}

function getFileIcon(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const map = {
        pptx: 'file-powerpoint', ppt: 'file-powerpoint',
        doc: 'file-word', docx: 'file-word',
        xls: 'file-excel', xlsx: 'file-excel', csv: 'file-csv',
        pdf: 'file-pdf',
        png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
        html: 'code', css: 'code', js: 'code', py: 'code',
        md: 'file-alt', txt: 'file-alt',
        zip: 'file-archive',
    };
    return map[ext] || 'file';
}

async function startTask() {
    const val = document.getElementById('taskInput').value.trim();
    if (!val) { alert('请输入任务描述'); return; }
    stopTask();
    taskRunning = true;
    showPage('taskPage');
    document.getElementById('taskTitle').textContent = val.length > 25 ? val.substring(0, 25) + '...' : val;
    document.getElementById('conversationBody').innerHTML = '';
    document.getElementById('previewPanel').style.display = 'none';
    document.getElementById('taskStatusBadge').innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>正在执行</span>';
    document.getElementById('taskStatusBadge').className = 'task-status-badge';
    document.getElementById('btnStop').style.display = 'flex';
    document.getElementById('chatInput').disabled = true;
    document.getElementById('btnSend').disabled = true;
    initSandboxForTask();
    addUserMessage(val);

    /* 创建会话并执行任务 */
    try {
        const session = await apiClient.createSession();
        currentThreadId = session.thread_id;

        const mc = addAgentMessage();

        await sseClient.runTask(currentThreadId, val, createSSECallbacks(mc, {
            onEnd: async function() {
                await loadSessionFiles(mc);
                markTaskComplete();
            },
            onError: function(msg) {
                addTextBlock(mc, '<span style="color:red;">执行出错: ' + msg + '</span>');
                markTaskComplete();
            },
            onAbort: function() {
                addTextBlock(mc, '<span style="color:orange;">任务已停止</span>');
                markTaskComplete();
            }
        }));
    } catch (err) {
        var mc2 = addAgentMessage();
        addTextBlock(mc2, '<span style="color:red;">无法创建会话: ' + (err.detail || err.message || '未知错误') + '</span>');
        markTaskComplete();
    }
}
