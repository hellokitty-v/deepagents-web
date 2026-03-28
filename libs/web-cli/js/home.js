/* 首页交互：任务类型切换、模板选择、图表选择 */
let selectedTemplate = '公安蓝';
let selectedChartType = '';
let activeTaskType = '';

const taskTypeConfig = {
    slides: { icon: 'file-powerpoint', label: '幻灯片', placeholder: '描述你的演示文稿主题', contentId: 'slidesType' },
    website: { icon: 'globe', label: '创建网站', placeholder: '描述你要创建的网站', contentId: 'websiteType' },
    visualization: { icon: 'chart-bar', label: '数据可视化', placeholder: '描述你的数据可视化需求', contentId: 'visualizationType' }
};

function toggleTaskType(type, btn) {
    const chip = document.getElementById('selectedTagChip');
    const input = document.getElementById('taskInput');

    // 如果点击已选中的类型，取消选中
    if (activeTaskType === type) {
        clearTaskType();
        return;
    }

    // 选中新类型
    activeTaskType = type;
    const cfg = taskTypeConfig[type];

    // 更新标签状态
    document.querySelectorAll('.task-tag').forEach(tag => tag.classList.remove('active'));
    btn.classList.add('active');

    // 显示输入框内chip
    chip.style.display = 'flex';
    chip.innerHTML = '<i class="fas fa-' + cfg.icon + ' tag-chip-icon"></i>' +
        '<span>' + cfg.label + '</span>' +
        '<button class="tag-chip-close" onclick="clearTaskType();event.stopPropagation();"><i class="fas fa-times"></i></button>';

    // 更新placeholder
    input.placeholder = cfg.placeholder;

    // 显示对应内容区域
    document.querySelectorAll('.task-type-content').forEach(c => c.classList.remove('active'));
    document.getElementById(cfg.contentId).classList.add('active');
}

function clearTaskType() {
    activeTaskType = '';
    document.getElementById('selectedTagChip').style.display = 'none';
    document.getElementById('taskInput').placeholder = '分配一个任务或提问任何问题';
    document.querySelectorAll('.task-tag').forEach(tag => tag.classList.remove('active'));
    document.querySelectorAll('.task-type-content').forEach(c => c.classList.remove('active'));
}

function fillTask(description) {
    document.getElementById('taskInput').value = description;
    document.getElementById('taskInput').focus();
}

function selectTemplate(element, name) {
    document.querySelectorAll('.template-item').forEach(i => i.classList.remove('active'));
    element.classList.add('active');
    selectedTemplate = name;
}

function selectChartType(element, type) {
    document.querySelectorAll('.chart-type-item').forEach(i => i.classList.remove('active'));
    element.classList.add('active');
    selectedChartType = type;
}
