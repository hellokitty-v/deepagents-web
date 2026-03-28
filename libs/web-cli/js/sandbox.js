/* 沙箱虚拟电脑预览模块 */
let sandboxState = { view: 'editor', currentFile: '', step: 0, totalSteps: 0, files: [] };

function openSandbox() {
    const p = document.getElementById('previewPanel');
    p.style.display = 'flex';
    p.innerHTML = '<div class="sandbox-container" id="sandboxRoot">' +
        '<div class="sandbox-titlebar">' +
        '<div class="sandbox-title"><i class="fas fa-desktop"></i><span>Dolphin 的电脑</span></div>' +
        '<div class="sandbox-status"><span class="status-dot"></span><span id="sandboxStatusText">准备中</span></div>' +
        '<div class="sandbox-controls"><span class="ctrl-close"></span><span class="ctrl-min"></span><span class="ctrl-max"></span></div>' +
        '</div>' +
        '<div class="sandbox-toolbar" id="sandboxToolbar"></div>' +
        '<div class="sandbox-body" id="sandboxBody"></div>' +
        '<div class="sandbox-footer">' +
        '<div class="sandbox-step-dots" id="sandboxDots"></div>' +
        '<div class="sandbox-progress-bar"><div class="sandbox-progress-fill" id="sandboxProgressFill"></div></div>' +
        '<div class="sandbox-step-info" id="sandboxStepInfo"></div>' +
        '</div></div>';
    sandboxState = { view: 'editor', currentFile: '', step: 0, totalSteps: 0, files: [] };
}

function setSandboxStatus(text, active) {
    const el = document.getElementById('sandboxStatusText');
    const dot = el ? el.previousElementSibling : null;
    if (el) el.textContent = text;
    if (dot) { dot.classList.toggle('idle', !active); }
}

function setSandboxProgress(step, total, label) {
    sandboxState.step = step;
    sandboxState.totalSteps = total;
    const fill = document.getElementById('sandboxProgressFill');
    const info = document.getElementById('sandboxStepInfo');
    const dots = document.getElementById('sandboxDots');
    if (fill) fill.style.width = (step / total * 100) + '%';
    if (info) info.textContent = label || (step + ' / ' + total);
    if (dots) {
        let h = '';
        for (let i = 1; i <= total; i++) {
            h += '<span class="dot ' + (i < step ? 'done' : (i === step ? 'active' : '')) + '"></span>';
        }
        dots.innerHTML = h;
    }
}

function setSandboxToolbar(tabs, activeTab) {
    const tb = document.getElementById('sandboxToolbar');
    if (!tb) return;
    tb.innerHTML = tabs.map(t =>
        '<button class="sandbox-tab' + (t.id === activeTab ? ' active' : '') + '" onclick="switchSandboxView(\'' + t.id + '\')">' +
        '<i class="fas fa-' + t.icon + '"></i> ' + t.label + '</button>'
    ).join('');
}

function switchSandboxView(viewId) {
    document.querySelectorAll('.sandbox-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sandbox-tab').forEach(t => {
        if (t.textContent.trim() && t.onclick && t.onclick.toString().includes(viewId)) t.classList.add('active');
    });
    const body = document.getElementById('sandboxBody');
    if (!body) return;
    if (viewId === 'editor') showEditorView();
    else if (viewId === 'terminal') showTerminalView();
    else if (viewId === 'preview') showWebviewPanel();
}

function showEditorView() {
    sandboxState.view = 'editor';
    const body = document.getElementById('sandboxBody');
    body.innerHTML = '<div class="sandbox-filetree" id="sandboxFileTree"></div>' +
        '<div class="sandbox-editor"><div class="editor-tab-bar" id="editorTabBar"></div>' +
        '<div class="editor-content" id="editorContent"></div></div>';
    renderFileTree();
}

function showTerminalView() {
    sandboxState.view = 'terminal';
    const body = document.getElementById('sandboxBody');
    body.innerHTML = '<div class="sandbox-terminal" id="sandboxTerminal"></div>';
}

function showWebviewPanel() {
    sandboxState.view = 'preview';
    const body = document.getElementById('sandboxBody');
    body.innerHTML = '<div class="sandbox-webview">' +
        '<div class="webview-urlbar"><div class="url-dots"><span></span><span></span><span></span></div>' +
        '<div class="webview-url" id="webviewUrl">preview.dolphin.local</div></div>' +
        '<div class="webview-body" id="webviewBody"></div></div>';
}

function renderFileTree() {
    const tree = document.getElementById('sandboxFileTree');
    if (!tree) return;
    tree.innerHTML = sandboxState.files.map(f => {
        const cls = 'filetree-item' + (f.indent ? ' indent-' + f.indent : '') +
            (f.dir ? ' dir' : '') + (f.name === sandboxState.currentFile ? ' active' : '');
        const icon = f.dir ? 'folder' : (f.icon || 'file');
        return '<div class="' + cls + '" data-filename="' + f.name + '"><i class="fas fa-' + icon + '"></i><span>' + f.name + '</span></div>';
    }).join('');

    // Add click handlers for file items
    tree.querySelectorAll('.filetree-item:not(.dir)').forEach(function(item) {
        item.addEventListener('click', function() {
            const filename = this.getAttribute('data-filename');
            if (filename) {
                loadFileContent(filename);
            }
        });
    });
}

function setEditorFile(filename, icon) {
    sandboxState.currentFile = filename;
    const tabBar = document.getElementById('editorTabBar');
    if (tabBar) {
        tabBar.innerHTML = '<div class="editor-tab active"><i class="fas fa-' + (icon || 'file-code') +
            '"></i><span>' + filename + '</span></div>';
    }
    renderFileTree();
}

function setEditorContent(lines) {
    const el = document.getElementById('editorContent');
    if (!el) return;
    el.innerHTML = lines.map((line, i) =>
        '<div class="code-line' + (line.hl ? ' highlight' : '') + '">' +
        '<span class="line-num">' + (i + 1) + '</span>' +
        '<span class="line-code">' + (line.html || escHtml(line.text || '')) + '</span></div>'
    ).join('');
    el.scrollTop = el.scrollHeight;
}

async function typeCodeLines(lines, startLine, speed) {
    speed = speed || 40;
    const el = document.getElementById('editorContent');
    if (!el) return;
    for (let i = 0; i < lines.length; i++) {
        if (!taskRunning) return;
        const ln = startLine + i;
        const div = document.createElement('div');
        div.className = 'code-line highlight';
        div.innerHTML = '<span class="line-num">' + ln + '</span><span class="line-code"></span>';
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
        const code = div.querySelector('.line-code');
        const text = lines[i].text || lines[i];
        const html = lines[i].html || null;
        if (html) { code.innerHTML = html; await delay(speed); }
        else { for (let j = 0; j < text.length; j++) { if (!taskRunning) return; code.textContent += text[j]; await delay(speed / 3); } }
        div.classList.remove('highlight');
        await delay(speed / 2);
    }
}

async function addTerminalLine(type, text, typeSpeed) {
    const term = document.getElementById('sandboxTerminal');
    if (!term) return;
    const div = document.createElement('div');
    div.className = 'term-line';
    if (type === 'cmd') {
        div.innerHTML = '<span class="term-prompt">$ </span><span class="term-cmd"></span>';
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
        const cmd = div.querySelector('.term-cmd');
        for (let i = 0; i < text.length; i++) { if (!taskRunning) return; cmd.textContent += text[i]; await delay(typeSpeed || 30); }
    } else {
        div.innerHTML = '<span class="term-' + type + '">' + text + '</span>';
        term.appendChild(div);
    }
    term.scrollTop = term.scrollHeight;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
