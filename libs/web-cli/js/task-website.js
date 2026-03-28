/* 网站任务完整执行流程 - 沙箱版 */
async function runWebsiteTask(desc) {
    const mc1 = addAgentMessage();
    addTextBlock(mc1, '我来帮你创建这个网站，先分析需求并设计页面结构。');
    await delay(600);
    if (!taskRunning) return;

    // 打开沙箱
    openSandbox();
    sandboxState.files = getWebsiteFileTree();
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' },
        { id: 'preview', icon: 'globe', label: '预览' }
    ], 'terminal');
    showTerminalView();
    setSandboxStatus('正在初始化项目', true);
    setSandboxProgress(1, 5, '1 / 5');

    await addThinkingBlock(mc1,
        '分析网站需求：需要创建一个专题网站。规划页面结构包含：' +
        '导航栏、Banner区域、内容展示模块、联系方式、页脚。' +
        '采用响应式设计，确保移动端兼容。使用现代化的 UI 风格。');
    await delay(400);
    if (!taskRunning) return;

    // 终端：初始化
    await addTerminalLine('cmd', 'mkdir -p website-project/{public/images,src}');
    await delay(200);
    await addTerminalLine('cmd', 'npm init -y');
    await addTerminalLine('output', 'Wrote to /website-project/package.json');
    if (!taskRunning) return;

    // 步骤1 - 需求分析
    const s1 = await addStepBlock(mc1, '需求分析与设计');
    setSandboxStatus('正在编辑 设计方案.md', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' },
        { id: 'preview', icon: 'globe', label: '预览' }
    ], 'editor');
    showEditorView();
    setEditorFile('设计方案.md', 'file-alt');
    await addActionStep(s1, 'lightbulb', '分析网站功能需求', 800);
    await typeCodeLines([
        { html: '<span class="hl-tag"># 禁毒宣传专题网站 - 设计方案</span>' },
        { text: '' },
        { html: '<span class="hl-tag">## 页面结构</span>' },
        { html: '- 导航栏：Logo + 菜单（首页/工作动态/成效展示/互动专区）' },
        { html: '- Banner：全屏渐变背景 + 标语 + CTA按钮' },
        { html: '- 内容区：四宫格卡片布局展示核心模块' },
        { html: '- 页脚：版权信息 + 联系方式' },
        { text: '' },
        { html: '<span class="hl-tag">## 技术栈</span>' },
        { html: '- HTML5 + CSS3 + JavaScript' },
        { html: '- 响应式设计（移动端适配）' },
    ], 1, 45);
    await addActionStep(s1, 'sitemap', '规划页面结构与导航', 700);
    await addActionStep(s1, 'file-alt', '创建文件: 设计方案.md', 500);
    if (!taskRunning) return;

    // 步骤2 - 开发页面
    const mc2 = addAgentMessage();
    const s2 = await addStepBlock(mc2, '开发页面');
    setSandboxProgress(2, 5, '2 / 5');
    setSandboxStatus('正在编辑 index.html', true);
    setEditorFile('index.html', 'file-code');
    document.getElementById('editorContent').innerHTML = '';
    await addActionStep(s2, 'code', '创建文件: index.html — 页面结构', 400);
    await typeCodeLines(getWebsiteHtmlCode(), 1, 30);
    if (!taskRunning) return;

    setSandboxProgress(3, 5, '3 / 5');
    setSandboxStatus('正在编辑 styles.css', true);
    setEditorFile('styles.css', 'file-code');
    document.getElementById('editorContent').innerHTML = '';
    await addActionStep(s2, 'paint-brush', '创建文件: styles.css — 样式设计', 400);
    await typeCodeLines(getWebsiteCssCode(), 1, 30);
    if (!taskRunning) return;

    await addActionStep(s2, 'js', '创建文件: script.js — 交互逻辑', 800);
    await addActionStep(s2, 'mobile-alt', '添加响应式布局适配', 700);
    await addActionStep(s2, 'mouse-pointer', '添加动画与交互效果', 600);
    await addActionStep(s2, 'check-double', '代码质量检查与优化', 500);
    if (!taskRunning) return;

    // 步骤3 - 部署
    const mc3 = addAgentMessage();
    addTextBlock(mc3, '网站开发完成，包含首页、内容展示、互动专区等模块。正在部署预览环境。');
    setSandboxProgress(4, 5, '4 / 5');
    setSandboxStatus('正在部署', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' },
        { id: 'preview', icon: 'globe', label: '预览' }
    ], 'terminal');
    showTerminalView();
    const s3 = await addStepBlock(mc3, '部署预览');
    await addTerminalLine('cmd', 'npm run build');
    await addActionStep(s3, 'server', '启动预览服务器', 600);
    await addTerminalLine('output', 'Build completed in 2.3s');
    await addTerminalLine('cmd', 'dolphin deploy ./dist --preview');
    await addActionStep(s3, 'cloud-upload-alt', '部署到预览环境', 800);
    await addTerminalLine('success', '✓ 部署成功');
    await addTerminalLine('success', '  预览地址: https://preview.dolphin.local/site-38a2');
    await addActionStep(s3, 'link', '生成预览链接: preview.dolphin.local/site-38a2', 500);
    if (!taskRunning) return;

    // 切换到网站预览
    setSandboxProgress(5, 5, '5 / 5');
    setSandboxStatus('预览就绪', false);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' },
        { id: 'preview', icon: 'globe', label: '预览' }
    ], 'preview');
    showWebviewPanel();
    document.getElementById('webviewUrl').textContent = 'https://preview.dolphin.local/site-38a2';
    document.getElementById('webviewBody').innerHTML = getWebsitePreviewHtml();
    await delay(300);

    // 步骤4 - 打包
    const mc4 = addAgentMessage();
    const s4 = await addStepBlock(mc4, '打包交付');
    await addActionStep(s4, 'file-archive', '打包网站源码', 800);
    await addActionStep(s4, 'check', '生成 网站源码.zip', 400);
    if (!taskRunning) return;

    addTextBlock(mc4, '网站已创建完毕并部署预览。你可以在右侧查看效果，也可以下载源码进行部署。');
    addFileChips(mc4, [
        { name: '网站源码.zip', icon: 'file-archive', type: 'web' },
        { name: '设计方案.md', icon: 'file-alt', type: 'md' },
        { name: 'index.html', icon: 'code', type: 'web' },
        { name: 'styles.css', icon: 'paint-brush', type: 'file' },
        { name: 'script.js', icon: 'js', type: 'file' }
    ]);
    addCompletionBlock(mc4, [
        { name: '网站源码.zip', icon: 'file-archive', type: 'web' },
        { name: '设计方案.md', icon: 'file-alt', type: 'md' }
    ]);
    markTaskComplete();
}
