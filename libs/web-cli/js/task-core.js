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

    await sseClient.runTask(currentThreadId, msg, {
        onMessage: function(data) {
            if (data.content) addTextBlock(mc, data.content);
        },
        onToolCall: function(data) {
            const name = data.tool_name || data.name || 'tool';
            addTextBlock(mc, '<div class="step-item-inline"><div class="step-icon loading">' +
                '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i></div>' +
                '<div class="step-text">调用工具: ' + name + '</div></div>');
        },
        onToolResult: function(data) {
            /* tool result handled silently */
        },
        onInterrupt: function(data) {
            showInterruptDialog(mc, data);
        },
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
    });
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

    await sseClient.resumeTask(currentThreadId, [{ type: decision }], {
        onMessage: function(data) {
            if (data.content) addTextBlock(mc, data.content);
        },
        onToolCall: function(data) {
            const name = data.tool_name || data.name || 'tool';
            addTextBlock(mc, '<div class="step-item-inline"><div class="step-icon loading">' +
                '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i></div>' +
                '<div class="step-text">调用工具: ' + name + '</div></div>');
        },
        onToolResult: function() {},
        onInterrupt: function(data) {
            showInterruptDialog(mc, data);
        },
        onEnd: async function() {
            await loadSessionFiles(mc);
            markTaskComplete();
        },
        onError: function(msg) {
            addTextBlock(mc, '<span style="color:red;">错误: ' + msg + '</span>');
        }
    });
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
    addUserMessage(val);

    /* 创建会话并执行任务 */
    try {
        const session = await apiClient.createSession();
        currentThreadId = session.thread_id;

        const mc = addAgentMessage();
        addTextBlock(mc, '<div class="step-item-inline"><div class="step-icon loading">' +
            '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i></div>' +
            '<div class="step-text">正在分析任务...</div></div>');

        await sseClient.runTask(currentThreadId, val, {
            onMessage: function(data) {
                if (data.content) addTextBlock(mc, data.content);
            },
            onToolCall: function(data) {
                var name = data.tool_name || data.name || 'tool';
                var args = data.args || {};
                var label = name;
                if (name === 'write_file' && args.path) label = '写入文件: ' + args.path;
                else if (name === 'read_file' && args.path) label = '读取文件: ' + args.path;
                else if (name === 'execute') label = '执行命令';
                else if (name === 'task') label = '委派子任务';

                addTextBlock(mc, '<div class="step-item-inline"><div class="step-icon loading">' +
                    '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i></div>' +
                    '<div class="step-text">' + label + '</div></div>');
            },
            onToolResult: function(data) {
                /* Update last step icon to complete */
                var steps = mc.querySelectorAll('.step-item-inline .step-icon.loading');
                if (steps.length > 0) {
                    var last = steps[steps.length - 1];
                    last.classList.remove('loading');
                    last.innerHTML = '<i class="fas fa-check" style="font-size:10px;color:var(--success-color);"></i>';
                }
            },
            onInterrupt: function(data) {
                showInterruptDialog(mc, data);
            },
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
        });
    } catch (err) {
        var mc2 = addAgentMessage();
        addTextBlock(mc2, '<span style="color:red;">无法创建会话: ' + (err.detail || err.message || '未知错误') + '</span>');
        markTaskComplete();
    }
}
