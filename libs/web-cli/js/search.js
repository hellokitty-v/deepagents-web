/* 搜索弹窗功能 */
const searchTaskData = [
    { name: '辖区治安周报', icon: 'file-powerpoint', desc: '已完成 · 生成上周辖区治安情况工作汇报PPT',
      date: '09:12', group: '今天', badge: 0 },
    { name: '禁毒宣传网站', icon: 'globe', desc: '已完成 · 制作禁毒宣传专题网站',
      date: '昨天', group: '昨天', badge: 2 },
    { name: '发案趋势分析', icon: 'chart-bar', desc: '已完成 · 可视化本月辖区刑事案件发案趋势',
      date: '3月20日', group: '过去7天', badge: 0 }
];

let searchOverlay = null;

function showSearch() {
    if (searchOverlay) return;
    searchOverlay = document.createElement('div');
    searchOverlay.className = 'search-overlay';
    searchOverlay.onclick = function(e) { if (e.target === searchOverlay) closeSearch(); };
    searchOverlay.innerHTML = buildSearchDialog('');
    document.body.appendChild(searchOverlay);
    const input = searchOverlay.querySelector('.search-dialog-input');
    if (input) input.focus();
}

function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.remove();
    searchOverlay = null;
}

function buildSearchDialog(query) {
    const results = filterResults(query);
    let html = '<div class="search-dialog">' +
        '<div class="search-input-row">' +
        '<i class="fas fa-search"></i>' +
        '<input class="search-dialog-input" type="text" placeholder="搜索任务..." ' +
        'value="' + escapeAttr(query) + '" oninput="onSearchInput(this.value)">' +
        '<button class="search-close-btn" onclick="closeSearch()"><i class="fas fa-times"></i></button>' +
        '</div><div class="search-results">';

    if (!query) {
        // 默认展示：新建任务 + 按时间分组的任务列表
        html += '<div class="search-new-task" onclick="closeSearch();document.getElementById(\'taskInput\').focus();">' +
            '<div class="search-new-icon"><i class="fas fa-edit"></i></div>' +
            '<span>新建任务</span></div>';
        html += buildGroupedResults(searchTaskData);
    } else if (results.length > 0) {
        html += buildGroupedResults(results);
    } else {
        html += '<div class="search-empty">未找到匹配的任务</div>';
    }
    html += '</div></div>';
    return html;
}

function filterResults(query) {
    if (!query) return searchTaskData;
    const q = query.toLowerCase();
    return searchTaskData.filter(t =>
        t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    );
}

function buildGroupedResults(items) {
    let html = '';
    let lastGroup = '';
    items.forEach(t => {
        if (t.group !== lastGroup) {
            lastGroup = t.group;
            html += '<div class="search-group-title">' + t.group + '</div>';
        }
        html += buildResultItem(t);
    });
    return html;
}

function buildResultItem(t) {
    const badge = t.badge ? '<span class="badge">' + t.badge + '</span>' : '';
    return '<div class="search-result-item" onclick="closeSearch();loadRecentTask(\'' + t.name + '\')">' +
        '<div class="search-result-icon"><i class="fas fa-' + t.icon + '"></i>' + badge + '</div>' +
        '<div class="search-result-content">' +
        '<div class="search-result-name">' + t.name + '</div>' +
        '<div class="search-result-desc">' + t.desc + '</div></div>' +
        '<div class="search-result-date">' + t.date + '</div></div>';
}

function onSearchInput(value) {
    if (!searchOverlay) return;
    const dialog = searchOverlay.querySelector('.search-dialog');
    const resultsEl = dialog.querySelector('.search-results');
    const results = filterResults(value);
    let html = '';
    if (!value) {
        html += '<div class="search-new-task" onclick="closeSearch();document.getElementById(\'taskInput\').focus();">' +
            '<div class="search-new-icon"><i class="fas fa-edit"></i></div>' +
            '<span>新建任务</span></div>';
        html += buildGroupedResults(searchTaskData);
    } else if (results.length > 0) {
        html += buildGroupedResults(results);
    } else {
        html += '<div class="search-empty">未找到匹配的任务</div>';
    }
    resultsEl.innerHTML = html;
}

function escapeAttr(s) { return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

/* 搜索弹窗内 ESC 关闭 */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && searchOverlay) { closeSearch(); e.preventDefault(); }
});
