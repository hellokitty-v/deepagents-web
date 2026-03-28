/* 预览面板：显示/关闭、文件预览、各类预览内容生成 */
function showPreview(title, html) {
    const p = document.getElementById('previewPanel');
    p.style.display = 'flex';
    // 如果当前是沙箱模式，恢复为标准预览结构
    if (!document.getElementById('previewBody')) {
        p.innerHTML = '<div class="preview-header">' +
            '<div class="preview-tabs" id="previewTabs"></div>' +
            '<button class="btn-icon btn-close-preview" onclick="closePreview()"><i class="fas fa-times"></i></button>' +
            '</div><div class="preview-body" id="previewBody"></div>';
    }
    document.getElementById('previewTabs').innerHTML = '<div class="preview-tab">' + title + '</div>';
    document.getElementById('previewBody').innerHTML = html;
}

function closePreview() { document.getElementById('previewPanel').style.display = 'none'; }

function previewFile(name, type) {
    if (type === 'ppt') showPreview(name, getSlidesPreviewHtml());
    else if (type === 'web') showPreview(name, getWebsitePreviewHtml());
    else if (type === 'chart') showPreview(name, getChartPreviewHtml());
    else if (type === 'md') showPreview(name, getMdPreviewHtml(name));
    else showPreview(name, '<div style="padding:40px;text-align:center;color:var(--text-secondary);">' +
        '<i class="fas fa-file" style="font-size:48px;margin-bottom:16px;display:block;"></i>' +
        '<p>' + name + '</p><p style="margin-top:8px;font-size:12px;">点击下载查看完整文件</p></div>');
}

function getSlidesPreviewHtml() {
    return '<div class="ppt-slide cover"><h3>辖区治安周报</h3><p>2024年3月第3周<br>XX市公安局XX分局</p></div>' +
        '<div class="ppt-slide"><h3>一、上周警情概述</h3><p>本周共接报警情 247 起，同比下降 8.5%。' +
        '其中刑事案件 32 起、治安案件 89 起、交通事故 56 起、群众求助 70 起。</p></div>' +
        '<div class="ppt-slide"><h3>二、案件类型分析</h3>' +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<div style="flex:1;background:#dbeafe;border-radius:6px;padding:12px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:700;color:#1e40af;">32</div><div style="font-size:11px;color:#6b7280;">刑事案件</div></div>' +
        '<div style="flex:1;background:#fef3c7;border-radius:6px;padding:12px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:700;color:#d97706;">89</div><div style="font-size:11px;color:#6b7280;">治安案件</div></div>' +
        '<div style="flex:1;background:#d1fae5;border-radius:6px;padding:12px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:700;color:#059669;">56</div><div style="font-size:11px;color:#6b7280;">交通事故</div></div>' +
        '</div></div>' +
        '<div class="ppt-slide"><h3>三、重点工作开展情况</h3><p>' +
        '1. 开展"净网"专项行动，破获电诈案件 8 起<br>' +
        '2. 推进社区警务改革，建设 12 个智慧安防小区<br>' +
        '3. 完成辖区重点场所安全检查 156 处</p></div>' +
        '<div class="ppt-slide"><h3>四、下周工作计划</h3><p>' +
        '1. 加强重点时段巡逻防控<br>' +
        '2. 推进电信诈骗专项整治行动<br>' +
        '3. 开展校园安全宣传活动<br>' +
        '4. 完善智慧安防系统建设</p></div>' +
        '<div class="slide-indicator">共 8 页 · 以上为部分预览</div>';
}

function getWebsitePreviewHtml() {
    return '<div class="web-preview">' +
        '<div class="web-nav"><i class="fas fa-shield-alt"></i> <span style="font-weight:600;">禁毒宣传专题</span>' +
        '<span style="margin-left:auto;font-size:12px;">首页</span>' +
        '<span style="font-size:12px;">工作动态</span>' +
        '<span style="font-size:12px;">成效展示</span>' +
        '<span style="font-size:12px;">互动专区</span></div>' +
        '<div class="web-banner"><h2>珍爱生命 远离毒品</h2><p>XX市公安局禁毒宣传专题网站</p>' +
        '<div style="margin-top:12px;display:inline-block;padding:6px 16px;background:rgba(255,255,255,0.2);' +
        'border-radius:20px;font-size:12px;">了解更多 ></div></div>' +
        '<div class="web-content">' +
        '<div class="web-card"><h4>禁毒知识</h4><p>了解毒品种类、危害及防范措施，提高全民禁毒意识</p></div>' +
        '<div class="web-card"><h4>工作动态</h4><p>最新禁毒工作进展、专项行动成果通报</p></div>' +
        '<div class="web-card"><h4>成效展示</h4><p>2024年破获毒品案件 128 起，缴获各类毒品 56.3 公斤</p></div>' +
        '<div class="web-card"><h4>互动专区</h4><p>在线举报、禁毒知识问答、宣传资料下载</p></div></div>' +
        '<div class="web-footer">XX市公安局 版权所有 · 网站建设：Dolphin AI</div></div>';
}

function getChartPreviewHtml() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const data = [
        { label: '1月', val: 65 }, { label: '2月', val: 45 },
        { label: '3月', val: 78 }, { label: '4月', val: 52 },
        { label: '5月', val: 88 }, { label: '6月', val: 42 }
    ];
    let bars = data.map((d, i) =>
        '<div class="bar-item"><div class="bar-fill" style="height:' + d.val + '%;background:' + colors[i] + ';"></div>' +
        '<div class="bar-label">' + d.label + '</div></div>'
    ).join('');
    return '<div class="chart-preview"><div class="chart-title">辖区案件发案趋势统计</div>' +
        '<div class="bar-chart">' + bars + '</div>' +
        '<div class="chart-legend"><span>单位：起</span><span>数据来源：警情数据库</span></div>' +
        '<div style="margin-top:20px;padding:16px;background:var(--bg-secondary);border-radius:8px;font-size:12px;' +
        'color:var(--text-secondary);line-height:1.8;">' +
        '<strong style="color:var(--text-primary);">分析结论：</strong><br>' +
        '1. 3月和5月为发案高峰期，需加强防控<br>' +
        '2. 2月和6月发案量较低，整体呈波动趋势<br>' +
        '3. 建议在高峰期增加巡逻密度</div></div>';
}

function getMdPreviewHtml(name) {
    if (name.includes('大纲')) {
        return '<div style="padding:16px;font-size:13px;line-height:2;color:var(--text-primary);">' +
            '<h3 style="margin-bottom:12px;font-size:16px;">汇报大纲</h3>' +
            '<p><strong>一、上周警情概述</strong></p><p style="padding-left:16px;">1.1 总体警情统计<br>1.2 同比环比分析</p>' +
            '<p><strong>二、案件类型分析</strong></p><p style="padding-left:16px;">2.1 刑事案件分布<br>2.2 治安案件分布<br>2.3 重点案件通报</p>' +
            '<p><strong>三、重点工作开展</strong></p><p style="padding-left:16px;">3.1 专项行动进展<br>3.2 社区警务工作<br>3.3 安全检查情况</p>' +
            '<p><strong>四、下周工作计划</strong></p><p style="padding-left:16px;">4.1 巡逻防控安排<br>4.2 专项整治计划<br>4.3 宣传活动安排</p></div>';
    }
    return '<div style="padding:16px;font-size:13px;line-height:1.8;color:var(--text-primary);">' +
        '<h3 style="margin-bottom:12px;font-size:16px;">' + name + '</h3>' +
        '<p style="color:var(--text-secondary);">文件内容预览（演示版本）</p></div>';
}
