/* 数据可视化任务完整执行流程 - 沙箱版 */
async function runVisualizationTask(desc) {
    const chartLabel = selectedChartType || '折线图';

    const mc1 = addAgentMessage();
    addTextBlock(mc1, '我来帮你进行数据可视化分析，先连接数据源获取数据。');
    await delay(600);
    if (!taskRunning) return;

    // 打开沙箱
    openSandbox();
    sandboxState.files = getVisualizationFileTree();
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'terminal');
    showTerminalView();
    setSandboxStatus('正在初始化项目', true);
    setSandboxProgress(1, 5, '1 / 5');

    await addThinkingBlock(mc1,
        '分析可视化需求：需要对案件数据进行分析和可视化。' +
        '确定使用' + chartLabel + '展示数据趋势，需要进行数据清洗、统计分析和异常值检测。' +
        '最终输出可视化图表和分析报告。');
    await delay(400);
    if (!taskRunning) return;

    // 终端：初始化
    await addTerminalLine('cmd', 'mkdir -p viz-project/{data,src,output}');
    await delay(200);
    await addTerminalLine('cmd', 'pip install pandas numpy matplotlib scipy');
    await addTerminalLine('output', 'Successfully installed matplotlib-3.8.3 scipy-1.12.0');
    if (!taskRunning) return;

    // 步骤1 - 数据采集
    const s1 = await addStepBlock(mc1, '数据采集');
    setSandboxStatus('正在连接数据源', true);
    await addTerminalLine('cmd', 'python fetch_police_data.py --type criminal');
    await addActionStep(s1, 'database', '连接公安数据源', 800);
    await addTerminalLine('output', '连接数据库 police_db@10.0.1.100... OK');
    await addActionStep(s1, 'download', '读取案件数据（1,832 条记录）', 900);
    await addTerminalLine('output', '获取记录: 1832 条');
    await addActionStep(s1, 'broom', '数据清洗与预处理', 800);
    await addTerminalLine('output', '清洗完成: 移除异常值 23 条, 有效记录 1809 条');
    await addTerminalLine('success', '✓ 导出: data/原始数据.csv');
    await addActionStep(s1, 'file-csv', '创建文件: 原始数据.csv', 500);
    if (!taskRunning) return;

    // 步骤2 - 数据分析
    const mc2 = addAgentMessage();
    const s2 = await addStepBlock(mc2, '数据分析');
    setSandboxProgress(2, 5, '2 / 5');
    setSandboxStatus('正在编辑 analysis.py', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'editor');
    showEditorView();
    setEditorFile('analysis.py', 'file-code');
    await addActionStep(s2, 'calculator', '统计分析：计算均值、中位数、标准差', 500);
    await typeCodeLines(getAnalysisCode(), 1, 35);
    if (!taskRunning) return;

    await addActionStep(s2, 'chart-line', '趋势计算：识别上升/下降趋势', 700);
    await addActionStep(s2, 'exclamation-triangle', '异常值检测：发现 3 个异常数据点', 600);

    // 终端执行分析
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'terminal');
    showTerminalView();
    await addTerminalLine('cmd', 'python src/analysis.py');
    await addTerminalLine('output', '共加载 1809 条记录');
    await addTerminalLine('output', '均值: 301.5  中位数: 289  标准差: 45.2');
    await addTerminalLine('output', '趋势: 下降 (slope=-2.31, p=0.04)');
    await addTerminalLine('success', '✓ 分析报告: output/数据分析.md');
    await addActionStep(s2, 'file-alt', '创建文件: 数据分析.md', 500);
    if (!taskRunning) return;

    // Agent 回复
    const mc3 = addAgentMessage();
    addTextBlock(mc3,
        '数据分析完成，发现 3 个关键趋势：<br>' +
        '1. 本月刑事案件较上月下降 12.3%<br>' +
        '2. 电信诈骗案件集中在周末时段<br>' +
        '3. 盗窃类案件在商业区占比最高<br><br>' +
        '开始生成可视化图表。');
    await delay(500);
    if (!taskRunning) return;

    // 步骤3 - 生成图表
    setSandboxProgress(3, 5, '3 / 5');
    setSandboxStatus('正在编辑 visualize.py', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'editor');
    showEditorView();
    setEditorFile('visualize.py', 'file-code');
    const s3 = await addStepBlock(mc3, '生成图表');
    await addActionStep(s3, 'palette', '选择图表类型：' + chartLabel, 400);
    await typeCodeLines(getVisualizeCode(), 1, 35);
    if (!taskRunning) return;

    setSandboxProgress(4, 5, '4 / 5');
    setSandboxStatus('正在渲染图表', true);
    setSandboxToolbar([
        { id: 'editor', icon: 'code', label: '代码' },
        { id: 'terminal', icon: 'terminal', label: '终端' }
    ], 'terminal');
    showTerminalView();
    await addTerminalLine('cmd', 'python src/visualize.py');
    await addActionStep(s3, 'sliders-h', '配置图表参数与配色方案', 600);
    await addTerminalLine('output', '渲染图表中...');
    await addActionStep(s3, 'chart-bar', '生成可视化图表', 900);
    await addTerminalLine('success', '✓ 图表已保存: output/数据图表.png');
    await addActionStep(s3, 'image', '导出 数据图表.png', 500);
    if (!taskRunning) return;

    // 预览图表
    setSandboxProgress(5, 5, '5 / 5');
    setSandboxStatus('预览就绪', false);
    showPreview('数据图表.png', getChartPreviewHtml());
    await delay(300);

    // 步骤4 - 生成报告
    const mc4 = addAgentMessage();
    const s4 = await addStepBlock(mc4, '生成报告');
    await addActionStep(s4, 'pen', '撰写分析结论与建议', 800);
    await addActionStep(s4, 'file-alt', '创建文件: 分析报告.md', 500);
    if (!taskRunning) return;

    addTextBlock(mc4, '数据可视化分析完成！图表和报告已生成，你可以在右侧预览图表效果。');
    addFileChips(mc4, [
        { name: '数据图表.png', icon: 'image', type: 'chart' },
        { name: '分析报告.md', icon: 'file-alt', type: 'md' },
        { name: '数据分析.md', icon: 'file-alt', type: 'md' },
        { name: '原始数据.csv', icon: 'file-csv', type: 'file' }
    ]);
    addCompletionBlock(mc4, [
        { name: '数据图表.png', icon: 'image', type: 'chart' },
        { name: '分析报告.md', icon: 'file-alt', type: 'md' },
        { name: '原始数据.csv', icon: 'file-csv', type: 'file' }
    ]);
    markTaskComplete();
}
