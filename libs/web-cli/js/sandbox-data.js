/* 沙箱预览内容数据 - 幻灯片任务 */
function getSlidesFileTree() {
    return [
        { name: 'slides-project', dir: true, icon: 'folder-open' },
        { name: 'data', dir: true, indent: 1 },
        { name: '数据汇总.xlsx', indent: 2, icon: 'file-excel' },
        { name: 'src', dir: true, indent: 1 },
        { name: '汇报大纲.md', indent: 2, icon: 'file-alt' },
        { name: 'slides.py', indent: 2, icon: 'file-code' },
        { name: 'output', dir: true, indent: 1 },
        { name: '辖区治安周报.pptx', indent: 2, icon: 'file-powerpoint' }
    ];
}

function getSlidesCodeData() {
    return [
        { html: '<span class="hl-keyword">from</span> pptx <span class="hl-keyword">import</span> Presentation' },
        { html: '<span class="hl-keyword">from</span> pptx.util <span class="hl-keyword">import</span> Inches, Pt' },
        { html: '<span class="hl-keyword">from</span> pptx.enum.text <span class="hl-keyword">import</span> PP_ALIGN' },
        { html: '<span class="hl-keyword">import</span> pandas <span class="hl-keyword">as</span> pd' },
        { text: '' },
        { html: '<span class="hl-comment"># 读取警情数据</span>' },
        { html: 'df = pd.read_excel(<span class="hl-string">"data/数据汇总.xlsx"</span>)' },
        { html: 'total = <span class="hl-func">len</span>(df)  <span class="hl-comment"># 247 条记录</span>' },
        { text: '' },
        { html: '<span class="hl-comment"># 创建演示文稿</span>' },
        { html: 'prs = <span class="hl-func">Presentation</span>()' },
        { html: 'prs.slide_width = Inches(<span class="hl-number">13.33</span>)' },
        { html: 'prs.slide_height = Inches(<span class="hl-number">7.5</span>)' },
        { text: '' },
        { html: '<span class="hl-comment"># 封面页</span>' },
        { html: 'slide = prs.slides.add_slide(prs.slide_layouts[<span class="hl-number">0</span>])' },
        { html: 'slide.shapes.title.text = <span class="hl-string">"辖区治安周报"</span>' },
        { html: 'slide.placeholders[<span class="hl-number">1</span>].text = <span class="hl-string">"2024年3月第3周"</span>' },
    ];
}

function getSlidesOutlineData() {
    return [
        { html: '<span class="hl-tag"># 辖区治安周报 - 汇报大纲</span>' },
        { text: '' },
        { html: '<span class="hl-tag">## 一、上周警情概述</span>' },
        { html: '- 总体警情统计：本周共接报 <span class="hl-number">247</span> 起' },
        { html: '- 同比下降 <span class="hl-number">8.5%</span>，环比上升 <span class="hl-number">2.1%</span>' },
        { text: '' },
        { html: '<span class="hl-tag">## 二、案件类型分析</span>' },
        { html: '- 刑事案件：<span class="hl-number">32</span> 起（盗窃 15、诈骗 8、其他 9）' },
        { html: '- 治安案件：<span class="hl-number">89</span> 起' },
        { html: '- 交通事故：<span class="hl-number">56</span> 起' },
        { html: '- 群众求助：<span class="hl-number">70</span> 起' },
        { text: '' },
        { html: '<span class="hl-tag">## 三、重点工作</span>' },
        { html: '- "净网"专项行动：破获电诈案件 <span class="hl-number">8</span> 起' },
        { html: '- 智慧安防小区建设：<span class="hl-number">12</span> 个' },
        { html: '- 重点场所安全检查：<span class="hl-number">156</span> 处' },
    ];
}

/* 沙箱预览内容数据 - 网站任务 */
function getWebsiteFileTree() {
    return [
        { name: 'website-project', dir: true, icon: 'folder-open' },
        { name: 'public', dir: true, indent: 1 },
        { name: 'images', dir: true, indent: 2 },
        { name: 'src', dir: true, indent: 1 },
        { name: 'index.html', indent: 2, icon: 'file-code' },
        { name: 'styles.css', indent: 2, icon: 'file-code' },
        { name: 'script.js', indent: 2, icon: 'file-code' },
        { name: 'package.json', indent: 1, icon: 'file-code' },
        { name: '设计方案.md', indent: 1, icon: 'file-alt' }
    ];
}

function getWebsiteHtmlCode() {
    return [
        { html: '<span class="hl-tag">&lt;!DOCTYPE html&gt;</span>' },
        { html: '<span class="hl-tag">&lt;html</span> <span class="hl-attr">lang</span>=<span class="hl-string">"zh-CN"</span><span class="hl-tag">&gt;</span>' },
        { html: '<span class="hl-tag">&lt;head&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;meta</span> <span class="hl-attr">charset</span>=<span class="hl-string">"UTF-8"</span><span class="hl-tag">&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;title&gt;</span>禁毒宣传专题<span class="hl-tag">&lt;/title&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;link</span> <span class="hl-attr">rel</span>=<span class="hl-string">"stylesheet"</span> <span class="hl-attr">href</span>=<span class="hl-string">"styles.css"</span><span class="hl-tag">&gt;</span>' },
        { html: '<span class="hl-tag">&lt;/head&gt;</span>' },
        { html: '<span class="hl-tag">&lt;body&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;nav</span> <span class="hl-attr">class</span>=<span class="hl-string">"navbar"</span><span class="hl-tag">&gt;</span>' },
        { html: '    <span class="hl-tag">&lt;div</span> <span class="hl-attr">class</span>=<span class="hl-string">"logo"</span><span class="hl-tag">&gt;</span>禁毒宣传专题<span class="hl-tag">&lt;/div&gt;</span>' },
        { html: '    <span class="hl-tag">&lt;ul</span> <span class="hl-attr">class</span>=<span class="hl-string">"nav-links"</span><span class="hl-tag">&gt;</span>' },
        { html: '      <span class="hl-tag">&lt;li&gt;&lt;a</span> <span class="hl-attr">href</span>=<span class="hl-string">"#home"</span><span class="hl-tag">&gt;</span>首页<span class="hl-tag">&lt;/a&gt;&lt;/li&gt;</span>' },
        { html: '      <span class="hl-tag">&lt;li&gt;&lt;a</span> <span class="hl-attr">href</span>=<span class="hl-string">"#about"</span><span class="hl-tag">&gt;</span>工作动态<span class="hl-tag">&lt;/a&gt;&lt;/li&gt;</span>' },
        { html: '    <span class="hl-tag">&lt;/ul&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;/nav&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;section</span> <span class="hl-attr">class</span>=<span class="hl-string">"hero"</span><span class="hl-tag">&gt;</span>' },
        { html: '    <span class="hl-tag">&lt;h1&gt;</span>珍爱生命 远离毒品<span class="hl-tag">&lt;/h1&gt;</span>' },
        { html: '    <span class="hl-tag">&lt;p&gt;</span>XX市公安局禁毒宣传专题<span class="hl-tag">&lt;/p&gt;</span>' },
        { html: '  <span class="hl-tag">&lt;/section&gt;</span>' },
    ];
}

function getWebsiteCssCode() {
    return [
        { html: '<span class="hl-comment">/* 全局样式 */</span>' },
        { html: '<span class="hl-tag">*</span> { <span class="hl-prop">margin</span>: <span class="hl-number">0</span>; <span class="hl-prop">padding</span>: <span class="hl-number">0</span>; <span class="hl-prop">box-sizing</span>: border-box; }' },
        { text: '' },
        { html: '<span class="hl-tag">body</span> {' },
        { html: '  <span class="hl-prop">font-family</span>: <span class="hl-string">"PingFang SC"</span>, sans-serif;' },
        { html: '  <span class="hl-prop">color</span>: <span class="hl-number">#1a1a2e</span>;' },
        { html: '}' },
        { text: '' },
        { html: '<span class="hl-tag">.navbar</span> {' },
        { html: '  <span class="hl-prop">background</span>: <span class="hl-number">#1e40af</span>;' },
        { html: '  <span class="hl-prop">padding</span>: <span class="hl-number">12px</span> <span class="hl-number">24px</span>;' },
        { html: '  <span class="hl-prop">display</span>: flex;' },
        { html: '  <span class="hl-prop">align-items</span>: center;' },
        { html: '}' },
        { text: '' },
        { html: '<span class="hl-tag">.hero</span> {' },
        { html: '  <span class="hl-prop">background</span>: <span class="hl-func">linear-gradient</span>(<span class="hl-number">135deg</span>, <span class="hl-number">#1e3a8a</span>, <span class="hl-number">#3b82f6</span>);' },
        { html: '  <span class="hl-prop">color</span>: white;' },
        { html: '  <span class="hl-prop">text-align</span>: center;' },
        { html: '  <span class="hl-prop">padding</span>: <span class="hl-number">80px</span> <span class="hl-number">20px</span>;' },
        { html: '}' },
    ];
}

/* 沙箱预览内容数据 - 可视化任务 */
function getVisualizationFileTree() {
    return [
        { name: 'viz-project', dir: true, icon: 'folder-open' },
        { name: 'data', dir: true, indent: 1 },
        { name: '原始数据.csv', indent: 2, icon: 'file-csv' },
        { name: 'src', dir: true, indent: 1 },
        { name: 'analysis.py', indent: 2, icon: 'file-code' },
        { name: 'visualize.py', indent: 2, icon: 'file-code' },
        { name: 'output', dir: true, indent: 1 },
        { name: '数据图表.png', indent: 2, icon: 'image' },
        { name: '分析报告.md', indent: 2, icon: 'file-alt' }
    ];
}

function getAnalysisCode() {
    return [
        { html: '<span class="hl-keyword">import</span> pandas <span class="hl-keyword">as</span> pd' },
        { html: '<span class="hl-keyword">import</span> numpy <span class="hl-keyword">as</span> np' },
        { html: '<span class="hl-keyword">from</span> scipy <span class="hl-keyword">import</span> stats' },
        { text: '' },
        { html: '<span class="hl-comment"># 加载数据</span>' },
        { html: 'df = pd.read_csv(<span class="hl-string">"data/原始数据.csv"</span>)' },
        { html: '<span class="hl-func">print</span>(<span class="hl-string">f"共加载 {len(df)} 条记录"</span>)' },
        { text: '' },
        { html: '<span class="hl-comment"># 统计分析</span>' },
        { html: 'monthly = df.groupby(<span class="hl-string">"month"</span>)[<span class="hl-string">"count"</span>].sum()' },
        { html: 'mean_val = monthly.mean()  <span class="hl-comment"># 均值</span>' },
        { html: 'std_val = monthly.std()    <span class="hl-comment"># 标准差</span>' },
        { text: '' },
        { html: '<span class="hl-comment"># 趋势检测</span>' },
        { html: 'slope, intercept, r, p, se = stats.linregress(' },
        { html: '    <span class="hl-func">range</span>(<span class="hl-func">len</span>(monthly)), monthly.values' },
        { html: ')' },
        { html: 'trend = <span class="hl-string">"上升"</span> <span class="hl-keyword">if</span> slope > <span class="hl-number">0</span> <span class="hl-keyword">else</span> <span class="hl-string">"下降"</span>' },
    ];
}

function getVisualizeCode() {
    return [
        { html: '<span class="hl-keyword">import</span> matplotlib.pyplot <span class="hl-keyword">as</span> plt' },
        { html: '<span class="hl-keyword">import</span> matplotlib' },
        { html: 'matplotlib.rcParams[<span class="hl-string">"font.sans-serif"</span>] = [<span class="hl-string">"SimHei"</span>]' },
        { text: '' },
        { html: '<span class="hl-comment"># 配置图表</span>' },
        { html: 'fig, ax = plt.subplots(figsize=(<span class="hl-number">12</span>, <span class="hl-number">6</span>))' },
        { html: 'colors = [<span class="hl-string">"#3b82f6"</span>, <span class="hl-string">"#10b981"</span>, <span class="hl-string">"#f59e0b"</span>,'},
        { html: '          <span class="hl-string">"#ef4444"</span>, <span class="hl-string">"#8b5cf6"</span>, <span class="hl-string">"#ec4899"</span>]' },
        { text: '' },
        { html: '<span class="hl-comment"># 绘制柱状图</span>' },
        { html: 'ax.bar(months, values, color=colors, width=<span class="hl-number">0.6</span>)' },
        { html: 'ax.set_title(<span class="hl-string">"辖区案件发案趋势统计"</span>, fontsize=<span class="hl-number">16</span>)' },
        { html: 'ax.set_xlabel(<span class="hl-string">"月份"</span>)' },
        { html: 'ax.set_ylabel(<span class="hl-string">"案件数（起）"</span>)' },
        { text: '' },
        { html: 'plt.tight_layout()' },
        { html: 'plt.savefig(<span class="hl-string">"output/数据图表.png"</span>, dpi=<span class="hl-number">150</span>)' },
        { html: '<span class="hl-func">print</span>(<span class="hl-string">"图表已保存"</span>)' },
    ];
}
