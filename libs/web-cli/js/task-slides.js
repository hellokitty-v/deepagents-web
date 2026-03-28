/* 幻灯片任务完整执行流程 - 沙箱版 */
async function runSlidesTask(desc) {
    const mc1 = addAgentMessage();
    addTextBlock(mc1, '我来帮你制作这份幻灯片，让我先收集相关数据。');
    await delay(600);
    if (!taskRunning) return;

    // 打开沙箱
    openSandbox();
    sandboxState.files = getSlidesFileTree();
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'terminal');
    showTerminalView();
    setSandboxStatus('正在初始化项目', true);
    setSandboxProgress(1, 5, '1 / 5');

    await addThinkingBlock(mc1,
        '分析任务需求：需要制作工作汇报幻灯片。确定大纲结构包含：' +
        '1.警情概述 2.案件类型分析 3.重点工作开展情况 4.下周工作计划。' +
        '将使用「' + selectedTemplate + '」模板，预计生成 8 页幻灯片。');
    await delay(400);
    if (!taskRunning) return;

    // 终端：初始化项目
    await addTerminalLine('cmd', 'mkdir -p slides-project/{data,src,output}');
    await delay(300);
    await addTerminalLine('cmd', 'pip install python-pptx pandas openpyxl');
    await addTerminalLine('output', 'Successfully installed python-pptx-0.6.23 pandas-2.2.1');
    if (!taskRunning) return;

    // 步骤1 - 收集数据
    const s1 = await addStepBlock(mc1, '收集数据');
    setSandboxStatus('正在采集警情数据', true);
    await addTerminalLine('cmd', 'python fetch_data.py --source police_db');
    await addActionStep(s1, 'search', '搜索辖区治安数据...', 1200);
    await addTerminalLine('output', '连接数据库... OK');
    await addTerminalLine('output', '查询警情记录: 247 条');
    await addActionStep(s1, 'globe', '浏览内网数据平台，获取警情记录', 1500);
    await addActionStep(s1, 'database', '读取警情数据库，提取统计指标', 1300);
    await addTerminalLine('success', '✓ 数据导出完成: data/数据汇总.xlsx');
    await addActionStep(s1, 'check', '创建文件: 数据汇总.xlsx', 800);
    if (!taskRunning) return;

    // 步骤2 - 撰写大纲
    const mc2 = addAgentMessage();
    addTextBlock(mc2, '数据收集完成，共获取警情记录 247 条，涵盖刑事案件、治安案件、交通事故等类别。现在开始撰写大纲。');
    setSandboxProgress(2, 5, '2 / 5');
    setSandboxStatus('正在编辑 汇报大纲.md', true);

    // 切换到编辑器视图显示大纲
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'editor');
    showEditorView();
    setEditorFile('汇报大纲.md', 'file-alt');
    await delay(300);

    const s2 = await addStepBlock(mc2, '撰写大纲');
    await addActionStep(s2, 'edit', '分析数据要点，提炼关键信息', 600);
    await typeCodeLines(getSlidesOutlineData(), 1, 50);
    if (!taskRunning) return;
    await addActionStep(s2, 'file-alt', '创建文件: 汇报大纲.md', 600);
    addFileChips(mc2, [
        { name: '汇报大纲.md', icon: 'file-alt', type: 'md' },
        { name: '数据汇总.xlsx', icon: 'file-excel', type: 'xlsx' }
    ]);
    await delay(400);

    // 步骤3 - 生成幻灯片
    const mc3 = addAgentMessage();
    const s3 = await addStepBlock(mc3, '生成幻灯片');
    setSandboxProgress(3, 5, '3 / 5');
    setSandboxStatus('正在编辑 slides.py', true);
    setEditorFile('slides.py', 'file-code');
    document.getElementById('editorContent').innerHTML = '';
    await addActionStep(s3, 'palette', '应用模板「' + selectedTemplate + '」', 400);
    await typeCodeLines(getSlidesCodeData(), 1, 35);
    if (!taskRunning) return;

    setSandboxProgress(4, 5, '4 / 5');
    setSandboxStatus('正在生成幻灯片', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'terminal');
    showTerminalView();
    await addTerminalLine('cmd', 'python src/slides.py');
    await addActionStep(s3, 'image', '生成封面页', 500);
    await addTerminalLine('output', '生成第 1/8 页: 封面');
    await addActionStep(s3, 'chart-bar', '生成警情概述页（含数据图表）', 700);
    await addTerminalLine('output', '生成第 2/8 页: 警情概述');
    await addActionStep(s3, 'chart-pie', '生成案件类型分析页', 600);
    await addTerminalLine('output', '生成第 3/8 页: 案件分析');
    await addActionStep(s3, 'list-check', '生成重点工作开展情况页', 600);
    await addActionStep(s3, 'calendar', '生成下周工作计划页', 500);
    await addTerminalLine('output', '生成第 4-8/8 页...');
    await addActionStep(s3, 'users', '生成团队工作总结页', 500);
    await addTerminalLine('success', '✓ 导出完成: output/辖区治安周报.pptx (8页)');
    await addActionStep(s3, 'file-powerpoint', '导出 辖区治安周报.pptx', 800);
    if (!taskRunning) return;

    // 预览PPT
    setSandboxProgress(5, 5, '5 / 5');
    setSandboxStatus('预览就绪', false);
    showPreview('辖区治安周报.pptx', getSlidesPreviewHtml());
    await delay(300);

    const mc4 = addAgentMessage();
    addTextBlock(mc4, '幻灯片已生成完毕，共 8 页。包含数据图表和趋势分析，你可以在右侧预览或直接下载。');
    addFileChips(mc4, [
        { name: '辖区治安周报.pptx', icon: 'file-powerpoint', type: 'ppt' },
        { name: '汇报大纲.md', icon: 'file-alt', type: 'md' },
        { name: '数据汇总.xlsx', icon: 'file-excel', type: 'xlsx' }
    ]);
    addCompletionBlock(mc4, [
        { name: '辖区治安周报.pptx', icon: 'file-powerpoint', type: 'ppt' },
        { name: '汇报大纲.md', icon: 'file-alt', type: 'md' },
        { name: '数据汇总.xlsx', icon: 'file-excel', type: 'xlsx' }
    ]);
    markTaskComplete();
}
