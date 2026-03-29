/* 页面切换、导航、快捷键、初始化 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navMap = { 'homePage': 0, 'libraryPage': 2, 'allTasksPage': 3 };
    if (navMap[pageId] !== undefined) {
        document.querySelectorAll('.nav-item')[navMap[pageId]].classList.add('active');
    }
}


function showLibrary() { showPage('libraryPage'); renderLibrary(); }
function showAllTasks() { showPage('allTasksPage'); renderTasksList(); }
function backToHome() { stopTask(); showPage('homePage'); }

function loadRecentTask(taskName) {
    const map = {
        '辖区治安周报': '生成上周辖区治安情况工作汇报PPT，包含警情概述、案件类型分析、重点工作开展情况、下周计划',
        '禁毒宣传网站': '制作禁毒宣传专题网站，包含背景介绍、工作动态、成效展示、互动专区',
        '发案趋势分析': '可视化本月辖区刑事案件发案趋势，使用折线图展示'
    };
    document.getElementById('taskInput').value = map[taskName] || taskName;
    startTask();
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); showSearch(); }
    if (e.key === 'Enter' && !e.shiftKey) {
        const el = document.activeElement;
        if (el && el.id === 'chatInput' && !el.disabled) { e.preventDefault(); sendFollowUp(); }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('Dolphin 公安智能体平台已加载');
    loadRecentSessions();
});

/* 加载最近会话到侧边栏 */
async function loadRecentSessions() {
    try {
        const result = await apiClient.listSessions({ limit: 5, order_by: 'updated_at', order: 'desc' });
        const container = document.querySelector('.recent-tasks');
        if (!container || !result.sessions) return;

        container.innerHTML = '<div class="section-title">最近任务</div>';
        result.sessions.forEach(s => {
            const icon = guessTaskIcon(s.title || '');
            const div = document.createElement('div');
            div.className = 'task-item';
            div.onclick = () => loadSessionHistory(s.thread_id);
            div.innerHTML = '<i class="fas fa-' + icon + '"></i><span>' + (s.title || '未命名会话') + '</span>';
            container.appendChild(div);
        });
    } catch (e) {
        console.warn('Failed to load recent sessions:', e);
    }
}

function guessTaskIcon(title) {
    if (/PPT|幻灯片|汇报|周报|总结|简报/.test(title)) return 'file-powerpoint';
    if (/网站|平台|网页/.test(title)) return 'globe';
    if (/可视化|图表|趋势|分析/.test(title)) return 'chart-bar';
    return 'comment-dots';
}

async function loadSessionHistory(threadId) {
    try {
        currentThreadId = threadId;
        showPage('taskPage');
        document.getElementById('conversationBody').innerHTML = '';
        document.getElementById('taskStatusBadge').innerHTML = '<i class="fas fa-check-circle"></i><span>已完成</span>';
        document.getElementById('taskStatusBadge').className = 'task-status-badge badge-success';
        document.getElementById('btnStop').style.display = 'none';
        document.getElementById('chatInput').disabled = false;
        document.getElementById('chatInput').placeholder = '继续对话...';
        document.getElementById('btnSend').disabled = false;

        const history = await apiClient.getSessionHistory(threadId);
        document.getElementById('taskTitle').textContent = history.title || '历史会话';

        // Initialize sandbox for history replay
        initSandboxForTask();

        // Render messages using shared logic
        if (history.messages) {
            renderMessagesFromHistory(history.messages);
        }
    } catch (e) {
        console.warn('Failed to load session history:', e);
    }
}

/* 库页面渲染 - 使用 API 数据 */
async function renderLibrary() {
    const el = document.getElementById('libraryContent');
    if (!el) return;

    el.innerHTML = '<div style="text-align:center;padding:40px;color:#999;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

    try {
        const result = await apiClient.listSessions({ limit: 20, order_by: 'updated_at', order: 'desc' });
        if (!result.sessions || result.sessions.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无文件</div>';
            return;
        }

        let html = '';
        for (const session of result.sessions) {
            try {
                const files = await apiClient.listFiles(session.thread_id);
                if (!files.files || files.files.length === 0) continue;

                const cards = files.files.map(f => {
                    const icon = getFileIcon(f.name);
                    const downloadUrl = apiClient.getDownloadURL(f.file_id);
                    return '<div class="lib-file-card">' +
                        '<div class="lib-card-header"><div class="lib-card-name">' +
                        '<i class="fas fa-' + icon + '"></i>' + f.name +
                        '</div><a href="' + downloadUrl + '" class="lib-card-menu" title="下载"><i class="fas fa-download"></i></a></div>' +
                        '<div class="lib-card-body"><h5>' + f.name + '</h5><p>大小: ' + formatFileSize(f.size) + '</p></div></div>';
                }).join('');

                html += '<div class="lib-group"><div class="lib-group-header">' +
                    '<span class="lib-group-title">' + (session.title || '未命名会话') + '</span>' +
                    '<span class="lib-group-date">' + formatDate(session.updated_at) + '</span></div>' +
                    '<div class="lib-group-files">' + cards + '</div></div>';
            } catch (e) {
                /* skip sessions with no files */
            }
        }

        el.innerHTML = html || '<div style="text-align:center;padding:40px;color:#999;">暂无文件</div>';
    } catch (e) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:red;">加载失败: ' + (e.detail || e.message || '') + '</div>';
    }
}

/* 所有任务列表 - 使用 API 数据 */
async function renderTasksList() {
    const el = document.getElementById('tasksList');
    if (!el) return;

    el.innerHTML = '<div style="text-align:center;padding:40px;color:#999;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

    try {
        const result = await apiClient.listSessions({ limit: 50, order_by: 'updated_at', order: 'desc' });
        if (!result.sessions || result.sessions.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无任务</div>';
            return;
        }

        el.innerHTML = result.sessions.map(s => {
            const icon = guessTaskIcon(s.title || '');
            return '<div class="task-list-item" onclick="loadSessionHistory(\'' + s.thread_id + '\')">' +
                '<div class="task-list-icon"><i class="fas fa-' + icon + '"></i></div>' +
                '<div class="task-list-info"><h4>' + (s.title || '未命名会话') + '</h4>' +
                '<p>' + (s.message_count || 0) + ' 条消息</p></div>' +
                '<div class="task-list-right"><span class="task-date">' + formatDate(s.updated_at) + '</span>' +
                '<span class="task-status completed">已完成</span></div></div>';
        }).join('');
    } catch (e) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:red;">加载失败: ' + (e.detail || e.message || '') + '</div>';
    }
}

/* 工具函数 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
        d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}
