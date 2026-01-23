// ============================================================================
// КОНФИГУРАЦИЯ ПРОЕКТА
// ============================================================================
const CONFIG = {
    GITHUB_USERNAME: 'ecopuls22-sys',
    REPO_NAME: 'eco-biyisk-map',
    DATA_FILE: 'data/objects.json',
    API_BASE: ''
};

// URL для данных
const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/main/${CONFIG.DATA_FILE}`;

// Роли пользователей
const ROLES = {
    GUEST: 'guest',
    USER: 'user',
    SPECIALIST: 'specialist',
    ADMIN: 'admin'
};

// Состояния панели
const PANEL_STATES = {
    DEFAULT: 'default',
    LOGIN: 'login',
    USER_DASHBOARD: 'user_dashboard',
    SPECIALIST_DASHBOARD: 'specialist_dashboard',
    ADMIN_DASHBOARD: 'admin_dashboard',
    REPORT_FORM: 'report_form',
    SUGGESTION_FORM: 'suggestion_form',
    ISSUE_DETAILS: 'issue_details',
    CREATE_POLL: 'create_poll',
    VIEW_POLLS: 'view_polls'
};

// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================================
let myMap;
let currentUser = {
    role: ROLES.GUEST,
    name: 'Гость',
    email: '',
    id: null
};
let currentObjects = [];
let currentIssues = [];
let currentPolls = [];
let selectedObject = null;
let selectedIssue = null;
let isSuggestingMode = false;
let lastUpdateTime = null;

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ
// ============================================================================
ymaps.ready(async function init() {
    console.log('🌳 Экологическая карта Бийска - Загрузка...');
    
    // Загружаем сохраненного пользователя
    if (typeof loadSavedUser === 'function') {
        loadSavedUser();
    } else {
        console.warn('⚠️ loadSavedUser не определена, пропускаем восстановление пользователя');
    }
    
    // Создаем карту
    myMap = new ymaps.Map('map', {
        center: [52.5186, 85.2076],
        zoom: 13,
        controls: ['zoomControl', 'fullscreenControl', 'typeSelector']
    });
    
    // Настройка элементов управления
    myMap.controls.get('zoomControl').options.set({
        size: 'large',
        position: { right: 10, top: 150 }
    });
    
    myMap.controls.get('fullscreenControl').options.set({
        position: { right: 10, top: 220 }
    });
    
    // Загружаем данные
    await loadData();
    
    // Инициализация интерфейса
    initializeUI();
    
    // Обновляем интерфейс
    updateUserInterface();
    
    // Периодическое обновление данных
    setInterval(loadData, 5 * 60 * 1000);
    
    console.log('✅ Карта готова!');
});

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================
async function loadData() {
    try {
        showNotification('Обновляем данные...', 'info');
        
        const apiBase = CONFIG.API_BASE || '';
        const apiUrl = `${apiBase}/api/data`;
        let response = await fetch(apiUrl);
        let data;
        
        if (response.ok) {
            data = await response.json();
        } else {
            const url = `${DATA_URL}?t=${Date.now()}&rand=${Math.random()}`;
            response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            data = await response.json();
        }
        
        // Обновляем данные
        currentObjects = data.objects || [];
        currentIssues = data.issues || [];
        currentPolls = data.polls || [];
        
        // Обновляем карту
        updateMapObjects();
        
        // Обновляем статистику
        updateStatistics();
        
        lastUpdateTime = new Date();
        updateLastUpdateTime();
        
        // Сохраняем локальную копию
        localStorage.setItem('eco_biysk_backup', JSON.stringify({
            objects: currentObjects,
            issues: currentIssues,
            polls: currentPolls,
            timestamp: Date.now()
        }));
        
        console.log(`✅ Данные обновлены: ${currentObjects.length} объектов, ${currentIssues.length} заявок`);
        showNotification(`Данные обновлены (${currentObjects.length} объектов)`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        
        // Используем локальную копию
        const localData = localStorage.getItem('eco_biysk_backup');
        if (localData) {
            const backup = JSON.parse(localData);
            currentObjects = backup.objects || getDefaultObjects();
            currentIssues = backup.issues || getDefaultIssues();
            currentPolls = backup.polls || getDefaultPolls();
            showNotification('Используем локальную копию данных', 'warning');
        } else {
            currentObjects = getDefaultObjects();
            currentIssues = getDefaultIssues();
            currentPolls = getDefaultPolls();
            showNotification('Используем демо-данные', 'info');
        }
        
        updateMapObjects();
        updateStatistics();
        
        lastUpdateTime = new Date();
        updateLastUpdateTime();
    }
}

// ============================================================================
// ОБНОВЛЕНИЕ КАРТЫ
// ============================================================================
function updateMapObjects() {
    // Очищаем карту
    myMap.geoObjects.removeAll();
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        addObjectToMap(obj);
    });
    
    // Добавляем заявки
    currentIssues.forEach(issue => {
        if (issue.status === 'approved' || currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
            addIssueToMap(issue);
        }
    });
}

function addObjectToMap(obj) {
    const placemark = new ymaps.Placemark(
        obj.coords,
        {
            balloonContent: createObjectBalloonContent(obj),
            hintContent: obj.name,
            objectId: obj.id,
            objectType: 'object'
        },
        {
            preset: 'islands#circleIcon',
            iconColor: getColorByType(obj.type),
            iconGlyph: getIconByType(obj.type),
            balloonCloseButton: true
        }
    );
    
    placemark.events.add('click', function(e) {
        const target = e.get('target');
        selectedObject = obj;
        
        // В зависимости от роли показываем разные действия
        if (currentUser.role === ROLES.USER) {
            showPanel(PANEL_STATES.REPORT_FORM);
        } else if (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
            showObjectManagementPanel(obj);
        } else {
            target.balloon.open();
        }
    });
    
    myMap.geoObjects.add(placemark);
}

function addIssueToMap(issue) {
    const placemark = new ymaps.Placemark(
        issue.coords,
        {
            balloonContent: createIssueBalloonContent(issue),
            hintContent: issue.type === 'suggestion' ? 'Предложение' : 'Проблема',
            objectId: issue.id,
            objectType: 'issue'
        },
        {
            preset: 'islands#circleIcon',
            iconColor: issue.status === 'approved' ? '#4CAF50' : 
                      issue.status === 'rejected' ? '#F44336' : '#FF9800',
            iconGlyph: issue.type === 'suggestion' ? 'lightbulb' : 'exclamation-triangle'
        }
    );
    
    placemark.events.add('click', function(e) {
        selectedIssue = issue;
        
        if (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
            showIssueDetailsPanel(issue);
        } else {
            e.get('target').balloon.open();
        }
    });
    
    myMap.geoObjects.add(placemark);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА
// ============================================================================
function initializeUI() {
    // Кнопка открытия панели управления
    document.getElementById('openControlPanel').addEventListener('click', function() {
        showPanel(PANEL_STATES.DEFAULT);
    });
    
    // Кнопка закрытия панели
    document.getElementById('closeControlPanel').addEventListener('click', function() {
        hidePanel();
    });
    
    // Кнопка обновления данных
    document.getElementById('refreshBtn').addEventListener('click', async function() {
        this.classList.add('rotating');
        await loadData();
        setTimeout(() => this.classList.remove('rotating'), 500);
    });
    
    // Кнопка "Добавить объект" (для специалистов/админов)
    document.getElementById('addBtn').addEventListener('click', function() {
        if (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
            showAddObjectForm();
        } else {
            showNotification('Только специалисты и администраторы могут добавлять объекты', 'warning');
        }
    });
    
    // Кнопка "Предложить идею"
    document.getElementById('suggestBtn').addEventListener('click', function() {
        if (currentUser.role === ROLES.USER) {
            startSuggestionMode();
        } else {
            showNotification('Войдите как пользователь, чтобы предлагать идеи', 'warning');
        }
    });
    
    // Кнопка "Найти меня"
    document.getElementById('locateBtn').addEventListener('click', locateUser);
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterObjects(this.dataset.filter);
        });
    });
    
    // Клик по элементам легенды
    document.querySelectorAll('.legend__item[data-type]').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.type;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const filterBtn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
            if (filterBtn) {
                filterBtn.classList.add('active');
                filterObjects(type);
            }
        });
    });
    
    // Сворачивание легенды
    document.getElementById('legendToggle').addEventListener('click', function() {
        const body = document.getElementById('legendBody');
        const icon = this.querySelector('i');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            body.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    });
    
    // Инициализация меню пользователя
    const userMenu = document.querySelector('.user-menu');
    if (userMenu) {
        userMenu.addEventListener('click', function() {
            if (currentUser.role === ROLES.GUEST) {
                showPanel(PANEL_STATES.LOGIN);
            } else {
                showPanel(PANEL_STATES.DEFAULT);
            }
        });
    }

    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', logoutUser);
    }
}

// ============================================================================
// ПАНЕЛЬ УПРАВЛЕНИЯ
// ============================================================================
function showPanel(panelState, data = null) {
    const panel = document.getElementById('controlPanel');
    const panelTitle = document.getElementById('panelTitle');
    const panelContent = document.getElementById('panelContent');
    
    // Показываем панель
    panel.classList.add('active');
    
    // Очищаем содержимое
    panelContent.innerHTML = '';
    
    // Загружаем нужную панель
    switch(panelState) {
        case PANEL_STATES.DEFAULT:
            panelTitle.innerHTML = '<i class="fas fa-cog"></i> Панель управления';
            loadDefaultPanel();
            break;
            
        case PANEL_STATES.LOGIN:
            panelTitle.innerHTML = '<i class="fas fa-sign-in-alt"></i> Смена роли';
            loadLoginPanel(data || ROLES.USER);
            break;
            
        case PANEL_STATES.USER_DASHBOARD:
            panelTitle.innerHTML = '<i class="fas fa-user"></i> Личный кабинет';
            loadUserDashboard();
            break;
            
        case PANEL_STATES.SPECIALIST_DASHBOARD:
            panelTitle.innerHTML = '<i class="fas fa-user-tie"></i> Кабинет специалиста';
            loadSpecialistDashboard();
            break;
            
        case PANEL_STATES.ADMIN_DASHBOARD:
            panelTitle.innerHTML = '<i class="fas fa-user-shield"></i> Панель администратора';
            loadAdminDashboard();
            break;
            
        case PANEL_STATES.REPORT_FORM:
            panelTitle.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Сообщить о проблеме';
            loadReportForm(data);
            break;
            
        case PANEL_STATES.SUGGESTION_FORM:
            panelTitle.innerHTML = '<i class="fas fa-lightbulb"></i> Предложить идею';
            loadSuggestionForm(data);
            break;
            
        case PANEL_STATES.ISSUE_DETAILS:
            panelTitle.innerHTML = '<i class="fas fa-tasks"></i> Детали заявки';
            loadIssueDetails(data);
            break;
            
        case PANEL_STATES.CREATE_POLL:
            panelTitle.innerHTML = '<i class="fas fa-poll"></i> Создать голосование';
            loadCreatePollForm();
            break;
            
        case PANEL_STATES.VIEW_POLLS:
            panelTitle.innerHTML = '<i class="fas fa-poll"></i> Голосования';
            loadPollsList();
            break;
    }
}

function hidePanel() {
    document.getElementById('controlPanel').classList.remove('active');
}

// Загрузка панелей
function loadDefaultPanel() {
    const panelContent = document.getElementById('panelContent');
    
    let content = `
        <div class="user-info-card">
            <div class="user-role-badge ${currentUser.role}">
                <i class="${getRoleIcon(currentUser.role)}"></i> ${getRoleName(currentUser.role)}
            </div>
            <h4>${currentUser.name}</h4>
            ${currentUser.email ? `<p>${currentUser.email}</p>` : ''}
        </div>
        
        <div class="panel-menu">
    `;
    
    // Меню в зависимости от роли
    switch(currentUser.role) {
        case ROLES.USER:
            content += `
                <button class="panel-menu-btn" id="userSuggestBtn">
                    <i class="fas fa-lightbulb"></i> Предложить идею
                </button>
                <button class="panel-menu-btn" id="userIssuesBtn">
                    <i class="fas fa-history"></i> Мои заявки
                </button>
                <button class="panel-menu-btn" id="userPollsBtn">
                    <i class="fas fa-poll"></i> Голосования
                </button>
                <button class="panel-menu-btn" id="userSwitchRoleBtn">
                    <i class="fas fa-exchange-alt"></i> Сменить роль
                </button>
                <button class="panel-menu-btn" id="userLogoutBtn">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            `;
            break;
            
        case ROLES.SPECIALIST:
            content += `
                <button class="panel-menu-btn" id="specIssuesBtn">
                    <i class="fas fa-tasks"></i> Заявки на рассмотрении
                    <span class="badge" id="pendingIssuesCount">${getPendingIssuesCount()}</span>
                </button>
                <button class="panel-menu-btn" id="specAddObjectBtn">
                    <i class="fas fa-plus-circle"></i> Добавить объект
                </button>
                <button class="panel-menu-btn" id="specSwitchRoleBtn">
                    <i class="fas fa-exchange-alt"></i> Сменить роль
                </button>
                <button class="panel-menu-btn" id="specLogoutBtn">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            `;
            break;
            
        case ROLES.ADMIN:
            content += `
                <button class="panel-menu-btn" id="adminAllIssuesBtn">
                    <i class="fas fa-list"></i> Все заявки
                </button>
                <button class="panel-menu-btn" id="adminCreatePollBtn">
                    <i class="fas fa-plus"></i> Создать голосование
                </button>
                <button class="panel-menu-btn" id="adminManagePollsBtn">
                    <i class="fas fa-poll"></i> Управление голосованиями
                </button>
                <button class="panel-menu-btn" id="adminStatsBtn">
                    <i class="fas fa-chart-bar"></i> Статистика
                </button>
                <button class="panel-menu-btn" id="adminSwitchRoleBtn">
                    <i class="fas fa-exchange-alt"></i> Сменить роль
                </button>
                <button class="panel-menu-btn" id="adminLogoutBtn">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            `;
            break;
            
        default: // GUEST
            content += `
                <button class="panel-menu-btn" id="guestLoginBtn">
                    <i class="fas fa-sign-in-alt"></i> Вход для пользователей
                </button>
                <button class="panel-menu-btn" id="guestSpecialistBtn">
                    <i class="fas fa-user-tie"></i> Вход для специалистов
                </button>
                <button class="panel-menu-btn" id="guestAdminBtn">
                    <i class="fas fa-user-shield"></i> Вход для администраторов
                </button>
            `;
    }
    
    content += `</div>`;
    panelContent.innerHTML = content;
    
    // Добавляем обработчики событий
    initializePanelButtons();
}

function loadLoginPanel(selectedRole = ROLES.USER) {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="login-form">
            <div class="form-group">
                <label for="loginEmail">Email:</label>
                <input type="email" id="loginEmail" class="form-input" placeholder="your@email.com">
            </div>
            
            <div class="form-group">
                <label for="loginName">Имя (необязательно):</label>
                <input type="text" id="loginName" class="form-input" placeholder="Ваше имя">
            </div>
            
            <div class="form-group">
                <label>Выберите роль:</label>
                <div class="login-type-selector">
                    <button class="login-type-btn" data-role="user">
                        <i class="fas fa-user"></i> Пользователь
                    </button>
                    <button class="login-type-btn" data-role="specialist">
                        <i class="fas fa-user-tie"></i> Специалист
                    </button>
                    <button class="login-type-btn" data-role="admin">
                        <i class="fas fa-user-shield"></i> Администратор
                    </button>
                </div>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" id="cancelLogin">Отмена</button>
                <button class="btn btn--primary" id="submitLogin">Сменить роль</button>
            </div>
            
            <div class="login-hint">
                <p><strong>Пользователь:</strong> может предлагать идеи, сообщать о проблемах, участвовать в голосованиях</p>
                <p><strong>Специалист:</strong> может добавлять объекты, рассматривать заявки</p>
                <p><strong>Администратор:</strong> полный доступ, создание голосований</p>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;

    const loginEmailInput = document.getElementById('loginEmail');
    const loginNameInput = document.getElementById('loginName');
    if (currentUser.role !== ROLES.GUEST) {
        if (loginEmailInput) loginEmailInput.value = currentUser.email || '';
        if (loginNameInput) loginNameInput.value = currentUser.name || '';
    }
    
    // Обработчики для формы входа
    document.querySelectorAll('.login-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.login-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const initialBtn = document.querySelector(`.login-type-btn[data-role="${selectedRole}"]`);
    if (initialBtn) {
        initialBtn.classList.add('active');
    } else {
        const fallbackBtn = document.querySelector('.login-type-btn[data-role="user"]');
        if (fallbackBtn) fallbackBtn.classList.add('active');
    }
    
    document.getElementById('cancelLogin').addEventListener('click', () => {
        showPanel(PANEL_STATES.DEFAULT);
    });
    
    document.getElementById('submitLogin').addEventListener('click', handleLogin);
}

function loadReportForm(object) {
    const panelContent = document.getElementById('panelContent');
    const obj = object || selectedObject;
    
    const content = `
        <div class="report-form">
            <div class="object-info">
                <h4>${obj.name}</h4>
                <p><i class="fas fa-${getIconByType(obj.type)}" style="color: ${getColorByType(obj.type)}"></i> ${getTypeName(obj.type)}</p>
            </div>
            
            <div class="form-group">
                <label for="reportType">Тип проблемы:</label>
                <select id="reportType" class="form-select">
                    <option value="damage">Повреждение</option>
                    <option value="disease">Болезнь/вредители</option>
                    <option value="trash">Скопление мусора</option>
                    <option value="vandalism">Вандализм</option>
                    <option value="other">Другое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="reportDescription">Описание проблемы:</label>
                <textarea id="reportDescription" class="form-textarea" 
                          placeholder="Опишите проблему подробно..." rows="4"></textarea>
            </div>
            
            <div class="form-group">
                <label>Срочность:</label>
                <div class="urgency-buttons">
                    <button class="urgency-btn" data-urgency="low">Низкая</button>
                    <button class="urgency-btn active" data-urgency="medium">Средняя</button>
                    <button class="urgency-btn" data-urgency="high">Высокая</button>
                </div>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" id="cancelReport">Отмена</button>
                <button class="btn btn--primary" id="submitReport">Отправить заявку</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Обработчики кнопок срочности
    document.querySelectorAll('.urgency-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.urgency-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    document.getElementById('cancelReport').addEventListener('click', () => {
        showPanel(PANEL_STATES.DEFAULT);
    });
    
    document.getElementById('submitReport').addEventListener('click', () => {
        const report = {
            type: 'problem',
            objectId: obj.id,
            objectName: obj.name,
            coords: obj.coords,
            description: document.getElementById('reportDescription').value,
            problemType: document.getElementById('reportType').value,
            urgency: document.querySelector('.urgency-btn.active').dataset.urgency,
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        submitIssue(report);
    });
}

function loadSpecialistDashboard() {
    const panelContent = document.getElementById('panelContent');
    const pendingIssues = currentIssues.filter(issue => issue.status === 'pending');
    
    let content = `
        <div class="dashboard-header">
            <h4>Заявки на рассмотрении: <span class="badge">${pendingIssues.length}</span></h4>
        </div>
        
        <div class="issues-list">
    `;
    
    if (pendingIssues.length === 0) {
        content += `<p class="no-data">Нет заявок на рассмотрении</p>`;
    } else {
        pendingIssues.forEach(issue => {
            content += `
                <div class="issue-card" data-id="${issue.id}">
                    <div class="issue-card__header">
                        <span class="issue-type ${issue.type}">
                            ${issue.type === 'suggestion' ? 'Предложение' : 'Проблема'}
                        </span>
                        <span class="issue-date">${formatDate(issue.createdAt)}</span>
                    </div>
                    <div class="issue-card__body">
                        <p><strong>${issue.objectName || 'Новая идея'}</strong></p>
                        <p>${issue.description.substring(0, 100)}...</p>
                        <p class="issue-author">От: ${issue.createdByName}</p>
                    </div>
                    <div class="issue-card__actions">
                        <button class="btn btn--small btn--primary view-issue-btn" data-id="${issue.id}">
                            <i class="fas fa-eye"></i> Просмотреть
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    content += `
        </div>
        
        <div class="dashboard-actions">
            <button class="btn btn--primary" id="addObjectBtn">
                <i class="fas fa-plus"></i> Добавить новый объект
            </button>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Обработчики для просмотра заявок
    document.querySelectorAll('.view-issue-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const issueId = this.dataset.id;
            const issue = currentIssues.find(i => i.id === issueId);
            if (issue) {
                showIssueDetailsPanel(issue);
            }
        });
    });
    
    document.getElementById('addObjectBtn').addEventListener('click', showAddObjectForm);
}

function loadIssueDetails(issue) {
    const panelContent = document.getElementById('panelContent');
    const issueData = issue || selectedIssue;
    
    let content = `
        <div class="issue-details">
            <div class="issue-header">
                <span class="issue-type-badge ${issueData.type}">
                    ${issueData.type === 'suggestion' ? '💡 Предложение' : '⚠️ Проблема'}
                </span>
                <span class="issue-status ${issueData.status}">${getStatusName(issueData.status)}</span>
            </div>
            
            <div class="issue-info">
                <h4>${issueData.objectName || 'Новая идея'}</h4>
                <p><strong>Автор:</strong> ${issueData.createdByName}</p>
                <p><strong>Дата:</strong> ${formatDate(issueData.createdAt)}</p>
                ${issueData.problemType ? `<p><strong>Тип проблемы:</strong> ${getProblemTypeName(issueData.problemType)}</p>` : ''}
                ${issueData.urgency ? `<p><strong>Срочность:</strong> ${getUrgencyName(issueData.urgency)}</p>` : ''}
            </div>
            
            <div class="issue-description">
                <h5>Описание:</h5>
                <p>${issueData.description}</p>
            </div>
    `;
    
    // Для специалиста/админа добавляем форму ответа
    if (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
        content += `
            <div class="issue-response">
                <h5>Ваш ответ:</h5>
                <textarea id="issueResponse" class="form-textarea" 
                          placeholder="Введите ваш ответ пользователю..." rows="3"></textarea>
                
                <div class="response-actions">
                    <button class="btn btn--success" id="approveIssue">
                        <i class="fas fa-check"></i> Одобрить
                    </button>
                    <button class="btn btn--warning" id="requestChanges">
                        <i class="fas fa-edit"></i> Запросить изменения
                    </button>
                    <button class="btn btn--danger" id="rejectIssue">
                        <i class="fas fa-times"></i> Отклонить
                    </button>
                </div>
            </div>
        `;
    }
    
    content += `</div>`;
    panelContent.innerHTML = content;
    
    // Обработчики для действий с заявкой
    if (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
        document.getElementById('approveIssue').addEventListener('click', () => {
            updateIssueStatus(issueData.id, 'approved', document.getElementById('issueResponse').value);
        });
        
        document.getElementById('requestChanges').addEventListener('click', () => {
            updateIssueStatus(issueData.id, 'changes_requested', document.getElementById('issueResponse').value);
        });
        
        document.getElementById('rejectIssue').addEventListener('click', () => {
            updateIssueStatus(issueData.id, 'rejected', document.getElementById('issueResponse').value);
        });
    }
}

// ============================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================================
function initializePanelButtons() {
    // Кнопки для гостя
    const guestLoginBtn = document.getElementById('guestLoginBtn');
    const guestSpecialistBtn = document.getElementById('guestSpecialistBtn');
    const guestAdminBtn = document.getElementById('guestAdminBtn');
    
    if (guestLoginBtn) guestLoginBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, ROLES.USER));
    if (guestSpecialistBtn) guestSpecialistBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, ROLES.SPECIALIST));
    if (guestAdminBtn) guestAdminBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, ROLES.ADMIN));
    
    // Кнопки для пользователя
    const userSuggestBtn = document.getElementById('userSuggestBtn');
    const userIssuesBtn = document.getElementById('userIssuesBtn');
    const userPollsBtn = document.getElementById('userPollsBtn');
    const userSwitchRoleBtn = document.getElementById('userSwitchRoleBtn');
    const userLogoutBtn = document.getElementById('userLogoutBtn');
    
    if (userSuggestBtn) userSuggestBtn.addEventListener('click', startSuggestionMode);
    if (userIssuesBtn) userIssuesBtn.addEventListener('click', showUserIssues);
    if (userPollsBtn) userPollsBtn.addEventListener('click', () => showPanel(PANEL_STATES.VIEW_POLLS));
    if (userSwitchRoleBtn) userSwitchRoleBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, currentUser.role));
    if (userLogoutBtn) userLogoutBtn.addEventListener('click', logoutUser);
    
    // Кнопки для специалиста
    const specIssuesBtn = document.getElementById('specIssuesBtn');
    const specAddObjectBtn = document.getElementById('specAddObjectBtn');
    const specSwitchRoleBtn = document.getElementById('specSwitchRoleBtn');
    const specLogoutBtn = document.getElementById('specLogoutBtn');
    
    if (specIssuesBtn) specIssuesBtn.addEventListener('click', () => showPanel(PANEL_STATES.SPECIALIST_DASHBOARD));
    if (specAddObjectBtn) specAddObjectBtn.addEventListener('click', showAddObjectForm);
    if (specSwitchRoleBtn) specSwitchRoleBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, currentUser.role));
    if (specLogoutBtn) specLogoutBtn.addEventListener('click', logoutUser);
    
    // Кнопки для администратора
    const adminAllIssuesBtn = document.getElementById('adminAllIssuesBtn');
    const adminCreatePollBtn = document.getElementById('adminCreatePollBtn');
    const adminManagePollsBtn = document.getElementById('adminManagePollsBtn');
    const adminStatsBtn = document.getElementById('adminStatsBtn');
    const adminSwitchRoleBtn = document.getElementById('adminSwitchRoleBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    
    if (adminAllIssuesBtn) adminAllIssuesBtn.addEventListener('click', showAllIssues);
    if (adminCreatePollBtn) adminCreatePollBtn.addEventListener('click', () => showPanel(PANEL_STATES.CREATE_POLL));
    if (adminManagePollsBtn) adminManagePollsBtn.addEventListener('click', () => showPanel(PANEL_STATES.VIEW_POLLS));
    if (adminStatsBtn) adminStatsBtn.addEventListener('click', showStatistics);
    if (adminSwitchRoleBtn) adminSwitchRoleBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN, currentUser.role));
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', logoutUser);
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const nameField = document.getElementById('loginName').value;
    const role = document.querySelector('.login-type-btn.active').dataset.role;
    
    // Простая валидация
    if (role === 'user') {
        if (!validateEmail(email)) {
            showNotification('Введите корректный email', 'error');
            return;
        }
        
        currentUser = {
            role: ROLES.USER,
            name: nameField || email.split('@')[0],
            email: email,
            id: 'user_' + Date.now()
        };
    } else if (role === 'specialist') {
        currentUser = {
            role: ROLES.SPECIALIST,
            name: nameField || 'Специалист',
            email: '',
            id: 'specialist_' + Date.now()
        };
    } else if (role === 'admin') {
        currentUser = {
            role: ROLES.ADMIN,
            name: nameField || 'Администратор',
            email: '',
            id: 'admin_' + Date.now()
        };
    }
    
    // Сохраняем пользователя
    localStorage.setItem('eco_biysk_user', JSON.stringify(currentUser));
    
    // Обновляем интерфейс
    updateUserInterface();
    showPanel(PANEL_STATES.DEFAULT);
    showNotification(`Добро пожаловать, ${currentUser.name}!`, 'success');
}

function logoutUser() {
    currentUser = {
        role: ROLES.GUEST,
        name: 'Гость',
        email: '',
        id: null
    };
    
    localStorage.removeItem('eco_biysk_user');
    updateUserInterface();
    showPanel(PANEL_STATES.DEFAULT);
    showNotification('Вы вышли из системы', 'info');
}

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================================================
function startSuggestionMode() {
    if (currentUser.role !== ROLES.USER) return;
    
    hidePanel();
    isSuggestingMode = true;
    showNotification('Нажмите на карту, чтобы предложить идею для этого места', 'info');
    
    myMap.container.getElement().style.cursor = 'crosshair';
    
    const clickHandler = function(e) {
        if (!isSuggestingMode) return;
        
        const coords = e.get('coords');
        
        // Создаем временную метку
        const tempPlacemark = new ymaps.Placemark(coords, {}, {
            preset: 'islands#circleIcon',
            iconColor: '#FF9800',
            iconGlyph: 'lightbulb'
        });
        
        myMap.geoObjects.add(tempPlacemark);
        
        // Показываем форму предложения
        showPanel(PANEL_STATES.SUGGESTION_FORM, { coords, tempPlacemark });
        
        // Завершаем режим
        isSuggestingMode = false;
        myMap.container.getElement().style.cursor = 'default';
        myMap.events.remove('click', clickHandler);
    };
    
    myMap.events.add('click', clickHandler);
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
function updateUserInterface() {
    const userNameElement = document.querySelector('.user-name');
    const userAvatar = document.querySelector('.user-avatar i');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }
    
    if (userAvatar) {
        userAvatar.className = getRoleIcon(currentUser.role);
    }

    if (headerLogoutBtn) {
        headerLogoutBtn.style.display = currentUser.role === ROLES.GUEST ? 'none' : 'inline-flex';
    }
    
    // Показываем/скрываем кнопки в зависимости от роли
    const suggestBtn = document.getElementById('suggestBtn');
    const addBtn = document.getElementById('addBtn');
    
    if (suggestBtn) {
        suggestBtn.style.display = currentUser.role === ROLES.USER ? 'flex' : 'none';
    }
    
    if (addBtn) {
        addBtn.style.display = (currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) ? 'flex' : 'none';
    }
}

function getRoleIcon(role) {
    switch(role) {
        case ROLES.USER: return 'fas fa-user';
        case ROLES.SPECIALIST: return 'fas fa-user-tie';
        case ROLES.ADMIN: return 'fas fa-user-shield';
        default: return 'fas fa-user';
    }
}

function getRoleName(role) {
    switch(role) {
        case ROLES.USER: return 'Пользователь';
        case ROLES.SPECIALIST: return 'Специалист';
        case ROLES.ADMIN: return 'Администратор';
        default: return 'Гость';
    }
}

function getStatusName(status) {
    switch(status) {
        case 'pending': return 'На рассмотрении';
        case 'approved': return 'Одобрено';
        case 'rejected': return 'Отклонено';
        case 'changes_requested': return 'Требуются изменения';
        default: return status;
    }
}

function getPendingIssuesCount() {
    return currentIssues.filter(issue => issue.status === 'pending').length;
}

function saveIssuesLocally() {
    const backup = JSON.parse(localStorage.getItem('eco_biysk_backup') || '{}');
    backup.issues = currentIssues;
    backup.timestamp = Date.now();
    localStorage.setItem('eco_biysk_backup', JSON.stringify(backup));
}

// ============================================================================
// ФУНКЦИИ ИЗ ПРЕДЫДУЩЕЙ ВЕРСИИ (оставляем без изменений)
// ============================================================================

function updateMapObjects() {
    // Очищаем карту
    myMap.geoObjects.removeAll();
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        addObjectToMap(obj);
    });
    
    // Добавляем заявки
    currentIssues.forEach(issue => {
        if (issue.status === 'approved' || currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN) {
            addIssueToMap(issue);
        }
    });
}

function updateStatistics() {
    // Статистика объектов
    const treeCount = currentObjects.filter(obj => obj.type === 'tree').length;
    const lawnCount = currentObjects.filter(obj => obj.type === 'lawn').length;
    const bushCount = currentObjects.filter(obj => obj.type === 'bush').length;
    
    document.getElementById('treeCount').textContent = treeCount;
    document.getElementById('lawnCount').textContent = lawnCount;
    document.getElementById('bushCount').textContent = bushCount;
    
    document.getElementById('statsTreeCount').textContent = treeCount;
    document.getElementById('statsLawnCount').textContent = lawnCount;
    document.getElementById('statsBushCount').textContent = bushCount;
    
    document.getElementById('totalObjects').textContent = currentObjects.length;
}

function updateLastUpdateTime() {
    if (!lastUpdateTime) return;
    
    const diffMs = new Date() - lastUpdateTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (!lastUpdateElement) return;
    
    if (diffMins < 1) {
        lastUpdateElement.textContent = 'только что';
    } else if (diffMins < 60) {
        lastUpdateElement.textContent = `${diffMins} мин. назад`;
    } else {
        const hours = Math.floor(diffMins / 60);
        lastUpdateElement.textContent = `${hours} ч. назад`;
    }
}

function createObjectBalloonContent(obj) {
    return `
        <div class="balloon-content">
            <h4>${obj.name}</h4>
            <p><strong>Тип:</strong> ${getTypeName(obj.type)}</p>
            <p><strong>Состояние:</strong> ${getConditionName(obj.condition)}</p>
            ${obj.description ? `<p><strong>Описание:</strong> ${obj.description}</p>` : ''}
            ${currentUser.role === ROLES.USER ? `
                <button class="btn btn--small btn--primary" onclick="showPanel('${PANEL_STATES.REPORT_FORM}')">
                    Сообщить о проблеме
                </button>
            ` : ''}
        </div>
    `;
}

function createIssueBalloonContent(issue) {
    return `
        <div class="balloon-content">
            <h4>${issue.type === 'suggestion' ? 'Предложение' : 'Проблема'}</h4>
            <p>${issue.description}</p>
            <p><strong>Статус:</strong> ${getStatusName(issue.status)}</p>
        </div>
    `;
}

function getColorByType(type) {
    const colors = {
        tree: '#2E7D32',
        lawn: '#4CAF50',
        bush: '#8BC34A',
        flowerbed: '#FF9800'
    };
    return colors[type] || '#757575';
}

function getIconByType(type) {
    const icons = {
        tree: 'tree',
        lawn: 'seedling',
        bush: 'leaf',
        flowerbed: 'flower'
    };
    return icons[type] || 'tree';
}

function getTypeName(type) {
    const types = {
        tree: 'Дерево',
        lawn: 'Газон',
        bush: 'Кустарник',
        flowerbed: 'Клумба',
        other: 'Другое'
    };
    return types[type] || type;
}

function getConditionName(condition) {
    const conditions = {
        good: 'Хорошее',
        normal: 'Нормальное',
        bad: 'Плохое'
    };
    return conditions[condition] || condition;
}

function filterObjects(filter) {
    // Скрываем/показываем объекты на карте
    myMap.geoObjects.each(geoObject => {
        if (geoObject.properties.get('objectType') === 'object') {
            const objectId = geoObject.properties.get('objectId');
            const object = currentObjects.find(obj => obj.id === objectId);
            
            if (!object) return;
            
            if (filter === 'all' || object.type === filter) {
                geoObject.options.set('visible', true);
            } else {
                geoObject.options.set('visible', false);
            }
        }
    });
}

function locateUser() {
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    showNotification('Определяем ваше местоположение...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        position => {
            const coords = [position.coords.latitude, position.coords.longitude];
            myMap.setCenter(coords, 15);
            
            const userPlacemark = new ymaps.Placemark(coords, {
                hintContent: 'Вы здесь'
            }, {
                preset: 'islands#bluePersonIcon'
            });
            
            myMap.geoObjects.add(userPlacemark);
            showNotification('Местоположение определено', 'success');
        },
        error => {
            showNotification('Не удалось определить местоположение', 'error');
        }
    );
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showPanelFromBalloon(panelState, data = null) {
    showPanel(panelState, data);
}

function loadSavedUser() {
    const savedUser = localStorage.getItem('eco_biysk_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАЯВКАМИ
// ============================================================================

function submitIssue(issue) {
    issue.id = 'issue_' + Date.now();
    currentIssues.push(issue);
    
    saveIssuesLocally();
    showNotification('Заявка отправлена', 'success');
    showPanel(PANEL_STATES.DEFAULT);
    updateMapObjects();
}

function showUserIssues() {
    const userIssues = currentIssues.filter(issue => issue.createdBy === currentUser.id);
    
    let content = `
        <div class="user-issues">
            <h4>Мои заявки (${userIssues.length})</h4>
            <div class="issues-list">
    `;
    
    if (userIssues.length === 0) {
        content += `<p class="no-data">У вас пока нет заявок</p>`;
    } else {
        userIssues.forEach(issue => {
            content += `
                <div class="issue-card">
                    <div class="issue-card__header">
                        <span class="issue-type ${issue.type}">
                            ${issue.type === 'suggestion' ? 'Предложение' : 'Проблема'}
                        </span>
                        <span class="issue-date">${formatDate(issue.createdAt)}</span>
                    </div>
                    <div class="issue-card__body">
                        <p><strong>${issue.objectName || 'Новая идея'}</strong></p>
                        <p>${issue.description.substring(0, 80)}...</p>
                        <p><span class="issue-status ${issue.status}">${getStatusName(issue.status)}</span></p>
                    </div>
                </div>
            `;
        });
    }
    
    content += `</div></div>`;
    
    document.getElementById('panelContent').innerHTML = content;
}

function showIssueDetailsPanel(issue) {
    showPanel(PANEL_STATES.ISSUE_DETAILS, issue);
}

function updateIssueStatus(issueId, status, response) {
    const issue = currentIssues.find(i => i.id === issueId);
    if (!issue) return;
    
    issue.status = status;
    issue.response = response;
    issue.resolvedBy = currentUser.name;
    issue.resolvedAt = new Date().toISOString();
    
    // Обновляем метку на карте
    if (issue.placemark) {
        issue.placemark.options.set('iconColor', 
            status === 'approved' ? '#4CAF50' : 
            status === 'rejected' ? '#F44336' : '#FF9800'
        );
    }
    
    // Сохраняем
    saveIssuesLocally();
    
    showNotification(`Статус заявки изменен на: ${getStatusName(status)}`, 'success');
    showPanel(PANEL_STATES.DEFAULT);
}

// ============================================================================
// ФУНКЦИИ ДЛЯ АДМИНИСТРАТОРА
// ============================================================================

function showAllIssues() {
    let content = `
        <div class="all-issues">
            <h4>Все заявки (${currentIssues.length})</h4>
            <div class="issues-list">
    `;
    
    currentIssues.forEach(issue => {
        content += `
            <div class="issue-card">
                <div class="issue-card__header">
                    <span class="issue-type ${issue.type}">
                        ${issue.type === 'suggestion' ? 'Предложение' : 'Проблема'}
                    </span>
                    <span class="issue-date">${formatDate(issue.createdAt)}</span>
                </div>
                <div class="issue-card__body">
                    <p><strong>${issue.objectName || 'Новая идея'}</strong></p>
                    <p>${issue.description.substring(0, 80)}...</p>
                    <p><span class="issue-status ${issue.status}">${getStatusName(issue.status)}</span></p>
                </div>
                <div class="issue-card__actions">
                    <button class="btn btn--small btn--primary" onclick="showIssueDetailsPanel(currentIssues.find(i => i.id === '${issue.id}'))">
                        Управление
                    </button>
                </div>
            </div>
        `;
    });
    
    content += `</div></div>`;
    
    document.getElementById('panelContent').innerHTML = content;
}

function showStatistics() {
    const totalIssues = currentIssues.length;
    const pendingIssues = currentIssues.filter(issue => issue.status === 'pending').length;
    const approvedIssues = currentIssues.filter(issue => issue.status === 'approved').length;
    const rejectedIssues = currentIssues.filter(issue => issue.status === 'rejected').length;
    
    const content = `
        <div class="statistics-panel">
            <h4>Статистика</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <h5>Объекты</h5>
                    <p>Всего: ${currentObjects.length}</p>
                    <p>Деревья: ${currentObjects.filter(o => o.type === 'tree').length}</p>
                    <p>Газоны: ${currentObjects.filter(o => o.type === 'lawn').length}</p>
                    <p>Кустарники: ${currentObjects.filter(o => o.type === 'bush').length}</p>
                </div>
                <div class="stat-card">
                    <h5>Заявки</h5>
                    <p>Всего: ${totalIssues}</p>
                    <p>На рассмотрении: ${pendingIssues}</p>
                    <p>Одобрено: ${approvedIssues}</p>
                    <p>Отклонено: ${rejectedIssues}</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('panelContent').innerHTML = content;
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ГОЛОСОВАНИЙ
// ============================================================================

function loadCreatePollForm() {
    const content = `
        <div class="poll-form">
            <div class="form-group">
                <label for="pollQuestion">Вопрос:</label>
                <input type="text" id="pollQuestion" class="form-input" placeholder="Введите вопрос...">
            </div>
            
            <div class="form-group">
                <label for="pollOptions">Варианты ответов (по одному на строку):</label>
                <textarea id="pollOptions" class="form-textarea" rows="5" placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3"></textarea>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--primary" onclick="createPoll()">Создать голосование</button>
            </div>
        </div>
    `;
    
    document.getElementById('panelContent').innerHTML = content;
}

function createPoll() {
    const question = document.getElementById('pollQuestion').value;
    const optionsText = document.getElementById('pollOptions').value;
    
    if (!question.trim() || !optionsText.trim()) {
        showNotification('Заполните все поля', 'warning');
        return;
    }
    
    const options = optionsText.split('\n').filter(option => option.trim());
    
    if (options.length < 2) {
        showNotification('Добавьте минимум 2 варианта ответа', 'warning');
        return;
    }
    
    const poll = {
        id: 'poll_' + Date.now(),
        question: question,
        options: options.map(option => ({ text: option, votes: 0 })),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name
    };
    
    currentPolls.push(poll);
    
    // Сохраняем локально
    const backup = JSON.parse(localStorage.getItem('eco_biysk_backup') || '{}');
    backup.polls = currentPolls;
    backup.timestamp = Date.now();
    localStorage.setItem('eco_biysk_backup', JSON.stringify(backup));
    
    showNotification('Голосование создано', 'success');
    showPanel(PANEL_STATES.DEFAULT);
}

function loadPollsList() {
    let content = `
        <div class="polls-list">
            <h4>Голосования (${currentPolls.length})</h4>
    `;
    
    if (currentPolls.length === 0) {
        content += `<p class="no-data">Нет активных голосований</p>`;
    } else {
        currentPolls.forEach(poll => {
            content += `
                <div class="poll-card">
                    <div class="poll-title">${poll.question}</div>
                    <div class="poll-options">
            `;
            
            poll.options.forEach((option, index) => {
                content += `
                    <div class="poll-option" onclick="voteInPoll('${poll.id}', ${index})">
                        <span>${option.text}</span>
                        <span>(${option.votes} голосов)</span>
                    </div>
                `;
            });
            
            content += `
                    </div>
                </div>
            `;
        });
    }
    
    content += `</div>`;
    
    document.getElementById('panelContent').innerHTML = content;
}

function voteInPoll(pollId, optionIndex) {
    const poll = currentPolls.find(p => p.id === pollId);
    if (!poll) return;
    
    poll.options[optionIndex].votes++;
    
    // Сохраняем локально
    const backup = JSON.parse(localStorage.getItem('eco_biysk_backup') || '{}');
    backup.polls = currentPolls;
    backup.timestamp = Date.now();
    localStorage.setItem('eco_biysk_backup', JSON.stringify(backup));
    
    showNotification('Ваш голос учтен', 'success');
    loadPollsList();
}

// ============================================================================
// ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ
// ============================================================================
function getDefaultObjects() {
    return [
        {
            id: 1,
            name: 'Старый дуб',
            type: 'tree',
            condition: 'good',
            description: 'Могучий дуб возрастом более 100 лет',
            coords: [52.5186, 85.2076],
            date: '2024-01-15'
        },
        {
            id: 2,
            name: 'Сквер Победы',
            type: 'lawn',
            condition: 'normal',
            description: 'Центральный газон с цветочными клумбами',
            coords: [52.5196, 85.2086],
            date: '2024-01-10'
        },
        {
            id: 3,
            name: 'Кусты сирени',
            type: 'bush',
            condition: 'good',
            description: 'Красивые кусты сирени вдоль аллеи',
            coords: [52.5176, 85.2066],
            date: '2024-01-12'
        }
    ];
}

function getDefaultPolls() {
    return [
        {
            id: 'poll_1',
            question: 'Какой проект благоустройства важнее?',
            options: [
                { text: 'Посадка деревьев', votes: 45 },
                { text: 'Установка скамеек', votes: 32 },
                { text: 'Детская площадка', votes: 28 }
            ],
            createdAt: '2024-03-10T10:00:00Z',
            createdBy: 'Администратор'
        }
    ];
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ФОРМ (которые использовались в других панелях)
// ============================================================================
function loadSuggestionForm(data) {
    const panelContent = document.getElementById('panelContent');
    const { coords, tempPlacemark } = data;
    
    const content = `
        <div class="suggestion-form">
            <div class="form-info">
                <p><i class="fas fa-map-marker-alt"></i> Вы выбрали место на карте</p>
                <p class="coords-info">Координаты: ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}</p>
            </div>
            
            <div class="form-group">
                <label for="suggestionTitle">Название идеи:</label>
                <input type="text" id="suggestionTitle" class="form-input" 
                       placeholder="Например: Посадка цветов, Установка скамеек...">
            </div>
            
            <div class="form-group">
                <label for="suggestionDescription">Подробное описание:</label>
                <textarea id="suggestionDescription" class="form-textarea" 
                          placeholder="Опишите вашу идею подробно, почему это важно, как это можно реализовать..." 
                          rows="5"></textarea>
            </div>
            
            <div class="form-group">
                <label for="suggestionCategory">Категория:</label>
                <select id="suggestionCategory" class="form-select">
                    <option value="planting">Посадка растений</option>
                    <option value="furniture">Установка малых форм</option>
                    <option value="lighting">Освещение</option>
                    <option value="path">Дорожки/тропинки</option>
                    <option value="other">Другое</option>
                </select>
            </div>
            
            <div class="form-hint">
                <p><i class="fas fa-info-circle"></i> Ваша идея будет рассмотрена специалистами в течение 3 рабочих дней</p>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" id="cancelSuggestion">Отмена</button>
                <button class="btn btn--primary" id="submitSuggestion">Отправить идею</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Удаляем временную метку при отмене
    document.getElementById('cancelSuggestion').addEventListener('click', () => {
        if (tempPlacemark) {
            myMap.geoObjects.remove(tempPlacemark);
        }
        showPanel(PANEL_STATES.DEFAULT);
    });
    
    // Отправка идеи
    document.getElementById('submitSuggestion').addEventListener('click', () => {
        const title = document.getElementById('suggestionTitle').value;
        const description = document.getElementById('suggestionDescription').value;
        const category = document.getElementById('suggestionCategory').value;
        
        if (!title.trim() || !description.trim()) {
            showNotification('Заполните название и описание идеи', 'warning');
            return;
        }
        
        // Создаем заявку
        const suggestion = {
            type: 'suggestion',
            title: title,
            description: description,
            category: category,
            coords: coords,
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        // Отправляем
        submitIssue(suggestion);
        
        // Удаляем временную метку
        if (tempPlacemark) {
            myMap.geoObjects.remove(tempPlacemark);
        }
    });
}

function showAddObjectForm() {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="add-object-form">
            <h4><i class="fas fa-plus-circle"></i> Добавить новый объект</h4>
            
            <div class="form-group">
                <label for="objectName">Название объекта:</label>
                <input type="text" id="objectName" class="form-input" 
                       placeholder="Например: Старый дуб, Центральный газон...">
            </div>
            
            <div class="form-group">
                <label for="objectType">Тип объекта:</label>
                <select id="objectType" class="form-select">
                    <option value="tree">Дерево</option>
                    <option value="bush">Кустарник</option>
                    <option value="lawn">Газон</option>
                    <option value="flowerbed">Клумба</option>
                    <option value="other">Другое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="objectDescription">Описание:</label>
                <textarea id="objectDescription" class="form-textarea" 
                          placeholder="Опишите объект..." rows="3"></textarea>
            </div>
            
            <div class="form-group">
                <label for="objectCondition">Состояние:</label>
                <select id="objectCondition" class="form-select">
                    <option value="good">Хорошее</option>
                    <option value="normal">Нормальное</option>
                    <option value="bad">Плохое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Координаты:</label>
                <div class="coords-input">
                    <input type="number" id="objectLat" class="form-input" step="0.000001" 
                           placeholder="Широта" value="52.5186">
                    <input type="number" id="objectLng" class="form-input" step="0.000001" 
                           placeholder="Долгота" value="85.2076">
                </div>
                <p class="form-hint">
                    <i class="fas fa-mouse-pointer"></i> 
                    Или выберите место на карте, затем нажмите "Взять с карты"
                </p>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" id="getFromMap">Взять с карты</button>
                <button class="btn btn--primary" id="submitObject">Добавить объект</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Кнопка "Взять с карты"
    document.getElementById('getFromMap').addEventListener('click', function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-mouse-pointer"></i> Кликните на карту...';
        
        const clickHandler = function(e) {
            const coords = e.get('coords');
            document.getElementById('objectLat').value = coords[0].toFixed(6);
            document.getElementById('objectLng').value = coords[1].toFixed(6);
            
            document.getElementById('getFromMap').disabled = false;
            document.getElementById('getFromMap').innerHTML = '<i class="fas fa-mouse-pointer"></i> Взять с карты';
            myMap.events.remove('click', clickHandler);
            
            showNotification('Координаты получены', 'success');
        };
        
        myMap.events.add('click', clickHandler);
        showNotification('Кликните на карту, чтобы выбрать место', 'info');
    });
    
    // Добавление объекта
    document.getElementById('submitObject').addEventListener('click', function() {
        const newObject = {
            id: 'obj_' + Date.now(),
            name: document.getElementById('objectName').value,
            type: document.getElementById('objectType').value,
            description: document.getElementById('objectDescription').value,
            condition: document.getElementById('objectCondition').value,
            coords: [
                parseFloat(document.getElementById('objectLat').value),
                parseFloat(document.getElementById('objectLng').value)
            ],
            date: new Date().toISOString().split('T')[0],
            createdBy: currentUser.name
        };
        
        if (!newObject.name.trim()) {
            showNotification('Введите название объекта', 'warning');
            return;
        }
        
        // Добавляем объект
        currentObjects.push(newObject);
        addObjectToMap(newObject);
        
        // Сохраняем локально
        const backup = JSON.parse(localStorage.getItem('eco_biysk_backup') || '{}');
        backup.objects = currentObjects;
        backup.timestamp = Date.now();
        localStorage.setItem('eco_biysk_backup', JSON.stringify(backup));
        
        showNotification('Объект успешно добавлен!', 'success');
        showPanel(PANEL_STATES.DEFAULT);
        updateStatistics();
    });
}
function validateEmail(email) {
    // Простая валидация email
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function getDefaultIssues() {
    return [
        {
            id: 'issue_1',
            type: 'problem',
            objectId: 1,
            objectName: 'Старый дуб',
            coords: [52.5180, 85.2100],
            description: 'На стволе дерева обнаружены следы вредителей, требуется обработка',
            problemType: 'disease',
            urgency: 'high',
            createdBy: 'user_1',
            createdByName: 'Иван Петров',
            createdAt: '2024-03-18T10:30:00Z',
            status: 'pending'
        },
        {
            id: 'issue_2',
            type: 'suggestion',
            coords: [52.5190, 85.2110],
            description: 'Предлагаю посадить цветущие кустарники вдоль аллеи для улучшения вида',
            createdBy: 'user_2',
            createdByName: 'Мария Сидорова',
            createdAt: '2024-03-17T14:20:00Z',
            status: 'approved',
            response: 'Отличное предложение! Добавили в план озеленения на весну.',
            resolvedBy: 'Специалист по благоустройству',
            resolvedAt: '2024-03-18T09:15:00Z'
        },
        {
            id: 'issue_3',
            type: 'problem',
            objectId: 3,
            objectName: 'Центральный газон',
            coords: [52.5200, 85.2080],
            description: 'На газоне образовались проплешины, требуется подсев травы',
            problemType: 'damage',
            urgency: 'medium',
            createdBy: 'user_3',
            createdByName: 'Алексей Смирнов',
            createdAt: '2024-03-16T16:45:00Z',
            status: 'pending'
        },
        {
            id: 'issue_4',
            type: 'suggestion',
            coords: [52.5175, 85.2065],
            description: 'Можно установить скамейки под деревьями для отдыха горожан',
            createdBy: 'user_4',
            createdByName: 'Ольга Козлова',
            createdAt: '2024-03-15T11:10:00Z',
            status: 'changes_requested',
            response: 'Хорошая идея, но нужно уточнить количество и расположение скамеек',
            resolvedBy: 'Специалист по благоустройству',
            resolvedAt: '2024-03-16T10:30:00Z'
        },
        {
            id: 'issue_5',
            type: 'problem',
            objectId: 4,
            objectName: 'Кусты сирени',
            coords: [52.5170, 85.2050],
            description: 'Вокруг кустов скопился мусор, требуется уборка',
            problemType: 'trash',
            urgency: 'low',
            createdBy: 'user_5',
            createdByName: 'Дмитрий Иванов',
            createdAt: '2024-03-14T09:20:00Z',
            status: 'rejected',
            response: 'Мусор уже убран, спасибо за сообщение',
            resolvedBy: 'Специалист по благоустройству',
            resolvedAt: '2024-03-15T08:45:00Z'
        }
    ];
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Экологическая карта Бийска запущена');
    console.log('👤 Текущий пользователь:', currentUser);
    
    // Периодическое обновление времени
    if (typeof updateLastUpdateTime === 'function') {
        setInterval(updateLastUpdateTime, 60000);
    } else {
        console.warn('⚠️ updateLastUpdateTime не определена, пропускаем обновление времени');
    }
    
    // Проверяем, есть ли сохраненный пользователь
    if (currentUser.role !== ROLES.GUEST) {
        showNotification(`С возвращением, ${currentUser.name}!`, 'info');
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('⚠️ Не удалось зарегистрировать service worker:', error);
        });
    });
}
