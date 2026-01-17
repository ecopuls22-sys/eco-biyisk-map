// ============================================================================
// КОНФИГУРАЦИЯ ПРОЕКТА
// ============================================================================
const CONFIG = {
    GITHUB_USERNAME: 'ecopuls22-sys',
    REPO_NAME: 'eco-biyisk-map',
    DATA_FILE: 'data/objects.json'
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
    loadSavedUser();
    
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
        
        const url = `${DATA_URL}?t=${Date.now()}&rand=${Math.random()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
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
            panelTitle.innerHTML = '<i class="fas fa-sign-in-alt"></i> Вход в систему';
            loadLoginPanel();
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

function loadLoginPanel() {
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
                <label>Выберите тип входа:</label>
                <div class="login-type-selector">
                    <button class="login-type-btn active" data-role="user">
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
            
            <div class="form-group" id="passwordGroup" style="display: none;">
                <label for="loginPassword">Пароль:</label>
                <input type="password" id="loginPassword" class="form-input" placeholder="Введите пароль">
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" id="cancelLogin">Отмена</button>
                <button class="btn btn--primary" id="submitLogin">Войти</button>
            </div>
            
            <div class="login-hint">
                <p><strong>Пользователь:</strong> может предлагать идеи, сообщать о проблемах, участвовать в голосованиях</p>
                <p><strong>Специалист:</strong> может добавлять объекты, рассматривать заявки</p>
                <p><strong>Администратор:</strong> полный доступ, создание голосований</p>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Обработчики для формы входа
    document.querySelectorAll('.login-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.login-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const passwordGroup = document.getElementById('passwordGroup');
            if (this.dataset.role === 'user') {
                passwordGroup.style.display = 'none';
            } else {
                passwordGroup.style.display = 'block';
            }
        });
    });
    
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
    
    if (guestLoginBtn) guestLoginBtn.addEventListener('click', () => showPanel(PANEL_STATES.LOGIN));
    if (guestSpecialistBtn) guestSpecialistBtn.addEventListener('click', handleSpecialistLogin);
    if (guestAdminBtn) guestAdminBtn.addEventListener('click', handleAdminLogin);
    
    // Кнопки для пользователя
    const userSuggestBtn = document.getElementById('userSuggestBtn');
    const userIssuesBtn = document.getElementById('userIssuesBtn');
    const userPollsBtn = document.getElementById('userPollsBtn');
    const userLogoutBtn = document.getElementById('userLogoutBtn');
    
    if (userSuggestBtn) userSuggestBtn.addEventListener('click', startSuggestionMode);
    if (userIssuesBtn) userIssuesBtn.addEventListener('click', showUserIssues);
    if (userPollsBtn) userPollsBtn.addEventListener('click', () => showPanel(PANEL_STATES.VIEW_POLLS));
    if (userLogoutBtn) userLogoutBtn.addEventListener('click', logoutUser);
    
    // Кнопки для специалиста
    const specIssuesBtn = document.getElementById('specIssuesBtn');
    const specAddObjectBtn = document.getElementById('specAddObjectBtn');
    const specLogoutBtn = document.getElementById('specLogoutBtn');
    
    if (specIssuesBtn) specIssuesBtn.addEventListener('click', () => showPanel(PANEL_STATES.SPECIALIST_DASHBOARD));
    if (specAddObjectBtn) specAddObjectBtn.addEventListener('click', showAddObjectForm);
    if (specLogoutBtn) specLogoutBtn.addEventListener('click', logoutUser);
    
    // Кнопки для администратора
    const adminAllIssuesBtn = document.getElementById('adminAllIssuesBtn');
    const adminCreatePollBtn = document.getElementById('adminCreatePollBtn');
    const adminManagePollsBtn = document.getElementById('adminManagePollsBtn');
    const adminStatsBtn = document.getElementById('adminStatsBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    
    if (adminAllIssuesBtn) adminAllIssuesBtn.addEventListener('click', showAllIssues);
    if (adminCreatePollBtn) adminCreatePollBtn.addEventListener('click', () => showPanel(PANEL_STATES.CREATE_POLL));
    if (adminManagePollsBtn) adminManagePollsBtn.addEventListener('click', () => showPanel(PANEL_STATES.VIEW_POLLS));
    if (adminStatsBtn) adminStatsBtn.addEventListener('click', showStatistics);
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', logoutUser);
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const name = document.getElementById('loginName').value || email.split('@')[0];
    const role = document.querySelector('.login-type-btn.active').dataset.role;
    const password = document.getElementById('loginPassword')?.value;
    
    // Простая валидация
    if (role === 'user') {
        if (!validateEmail(email)) {
            showNotification('Введите корректный email', 'error');
            return;
        }
        
        currentUser = {
            role: ROLES.USER,
            name: name,
            email: email,
            id: 'user_' + Date.now()
        };
    } else if (role === 'specialist') {
        if (!password || password !== 'specialist123') {
            showNotification('Неверный пароль специалиста', 'error');
            return;
        }
        
        currentUser = {
            role: ROLES.SPECIALIST,
            name: 'Специалист',
            email: '',
            id: 'specialist_' + Date.now()
        };
    } else if (role === 'admin') {
        if (!password || password !== 'admin123') {
            showNotification('Неверный пароль администратора', 'error');
            return;
        }
        
        currentUser = {
            role: ROLES.ADMIN,
            name: 'Администратор',
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
        showPanel(PANEL_STATES.SUGGESTION_FORM, { coords: coords, tempPlacemark: tempPlacemark });
        
        isSuggestingMode = false;
        myMap.container.getElement().style.cursor = '';
        myMap.events.remove('click', clickHandler);
    };
    
    myMap.events.add('click', clickHandler);
}

function submitIssue(issueData) {
    // Генерируем ID
    issueData.id = 'issue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Добавляем в массив
    currentIssues.push(issueData);
    
    // Сохраняем (в реальном проекте - отправляем на сервер)
    saveIssuesLocally();
    
    // Добавляем на карту
    addIssueToMap(issueData);
    
    // Показываем уведомление
    showNotification('Заявка отправлена!', 'success');
    
    // Возвращаемся на главную панель
    showPanel(PANEL_STATES.DEFAULT);
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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
function updateUserInterface() {
    const userNameElement = document.querySelector('.user-name');
    const userAvatar = document.querySelector('.user-avatar i');
    
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }
    
    if (userAvatar) {
        userAvatar.className = getRoleIcon(currentUser.role);
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
function loadSavedUser() {
    const savedUser = localStorage.getItem('eco_biysk_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
}

function filterObjects(filterType) {
    // Скрываем все объекты
    currentObjects.forEach(obj => {
        if (obj.placemark) {
            obj.placemark.options.set('visible', false);
        }
    });
    
    // Показываем объекты по фильтру
    currentObjects.forEach(obj => {
        if (filterType === 'all' || obj.type === filterType) {
            if (obj.placemark) {
                obj.placemark.options.set('visible', true);
            }
        }
    });
    
    // Подсвечиваем активный элемент в легенде
    document.querySelectorAll('.legend__item[data-type]').forEach(item => {
        item.classList.remove('active');
    });
    
    if (filterType !== 'all') {
        const legendItem = document.querySelector(`.legend__item[data-type="${filterType}"]`);
        if (legendItem) {
            legendItem.classList.add('active');
        }
    }
}


function updateStatistics() {
    const treeCount = currentObjects.filter(obj => obj.type === 'tree').length;
    const lawnCount = currentObjects.filter(obj => obj.type === 'lawn').length;
    const bushCount = currentObjects.filter(obj => obj.type === 'bush').length;
    const totalCount = currentObjects.length;
    
    // Обновляем счетчики в легенде
    document.getElementById('treeCount').textContent = treeCount;
    document.getElementById('lawnCount').textContent = lawnCount;
    document.getElementById('bushCount').textContent = bushCount;
    
    // Обновляем счетчики в панели
    document.getElementById('statsTreeCount').textContent = treeCount;
    document.getElementById('statsLawnCount').textContent = lawnCount;
    document.getElementById('statsBushCount').textContent = bushCount;
    
    // Обновляем общее количество
    document.getElementById('totalObjects').textContent = totalCount;
}


function updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    if (!element) return;
    
    if (lastUpdateTime) {
        const now = new Date();
        const diffMinutes = Math.floor((now - lastUpdateTime) / (1000 * 60));
        
        if (diffMinutes < 1) {
            element.textContent = 'Только что';
        } else if (diffMinutes < 60) {
            element.textContent = `${diffMinutes} мин. назад`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);
            element.textContent = `${diffHours} ч. назад`;
        }
    } else {
        element.textContent = 'Неизвестно';
    }
}


function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                
                // Удаляем старый маркер
                if (userPlacemark) {
                    myMap.geoObjects.remove(userPlacemark);
                }
                
                // Создаем новый маркер
                userPlacemark = new ymaps.Placemark(
                    userLocation,
                    {
                        hintContent: 'Вы здесь',
                        balloonContent: 'Ваше текущее местоположение'
                    },
                    {
                        preset: 'islands#blueCircleDotIcon',
                        iconColor: '#2196F3'
                    }
                );
                
                myMap.geoObjects.add(userPlacemark);
                myMap.setCenter(userLocation, 15);
                
                showNotification('Ваше местоположение определено');
            },
            function(error) {
                let message = 'Не удалось определить местоположение';
                if (error.code === error.PERMISSION_DENIED) {
                    message = 'Разрешите доступ к геолокации в настройках браузера';
                }
                showNotification(message, 'error');
            }
        );
    } else {
        showNotification('Геолокация не поддерживается', 'error');
    }
}


function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = 'notification';
    
    // Цвета для разных типов уведомлений
    switch(type) {
        case 'success':
            notification.style.background = '#4CAF50';
            break;
        case 'error':
            notification.style.background = '#F44336';
            break;
        case 'warning':
            notification.style.background = '#FF9800';
            break;
        case 'info':
            notification.style.background = '#2196F3';
            break;
    }
    
    notification.style.display = 'block';
    notification.style.animation = 'slideIn 0.3s ease';
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}


// Функции для работы с данными (оставляем без изменений)
function getDefaultObjects() {
    return [
        {
            id: 1,
            name: 'Старый дуб',
            type: 'tree',
            condition: 'good',
            coords: [52.5180, 85.2100],
            description: 'Крупный дуб возрастом около 50 лет',
            date: '2024-03-15'
        },
        {
            id: 2,
            name: 'Липовая аллея',
            type: 'tree',
            condition: 'normal',
            coords: [52.5150, 85.2150],
            description: 'Аллея из 20 лип вдоль центральной улицы',
            date: '2024-03-10'
        },
        {
            id: 3,
            name: 'Центральный газон',
            type: 'lawn',
            condition: 'good',
            coords: [52.5200, 85.2080],
            description: 'Ухоженный газон у городской администрации',
            date: '2024-03-12'
        },
        {
            id: 4,
            name: 'Кусты сирени',
            type: 'bush',
            condition: 'normal',
            coords: [52.5170, 85.2050],
            description: 'Группа кустов сирени у школы',
            date: '2024-03-08'
        }
    ];
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

function getDefaultPolls() {
    return [
        {
            id: 'poll_1',
            title: 'Какой парк нужно благоустроить в первую очередь?',
            description: 'Выберите парк, который требует первоочередного внимания',
            options: ['Центральный парк', 'Парк Победы', 'Набережная Бии', 'Сквер у Драмтеатра'],
            votes: [125, 89, 210, 67],
            createdBy: 'admin_1',
            createdAt: '2024-03-01T00:00:00Z',
            endsAt: '2024-04-01T00:00:00Z',
            isActive: true
        },
        {
            id: 'poll_2',
            title: 'Какие деревья посадить на новой аллее?',
            description: 'Голосование за виды деревьев для посадки',
            options: ['Липы', 'Клены', 'Березы', 'Дубы', 'Рябины'],
            votes: [45, 78, 120, 65, 92],
            createdBy: 'specialist_1',
            createdAt: '2024-02-15T00:00:00Z',
            endsAt: '2024-03-15T00:00:00Z',
            isActive: false,
            results: 'Победили березы и рябины. Они будут высажены весной.'
        },
        {
            id: 'poll_3',
            title: 'Нужна ли установка дополнительных урн в парках?',
            description: 'Голосуйте за увеличение количества урн для мусора',
            options: ['Да, нужно больше урн', 'Нет, достаточно имеющихся', 'Нужны только в местах пикников'],
            votes: [320, 45, 189],
            createdBy: 'admin_1',
            createdAt: '2024-03-10T00:00:00Z',
            endsAt: '2024-03-31T00:00:00Z',
            isActive: true
        }
    ];
}

function getColorByType(type) {
    switch(type) {
        case 'tree': return '#2E7D32';
        case 'lawn': return '#4CAF50';
        case 'bush': return '#8BC34A';
        default: return '#757575';
    }
}

function getIconByType(type) {
    switch(type) {
        case 'tree': return 'tree';
        case 'lawn': return 'leaf';
        case 'bush': return 'leaf';
        default: return 'placemark';
    }
}

function getTypeName(type) {
    switch(type) {
        case 'tree': return 'Дерево';
        case 'lawn': return 'Газон';
        case 'bush': return 'Кустарник';
        default: return 'Объект';
    }
}

function getConditionName(condition) {
    switch(condition) {
        case 'good': return 'Хорошее';
        case 'normal': return 'Нормальное';
        case 'bad': return 'Плохое';
        default: return 'Неизвестно';
    }
}

function getConditionIcon(condition) {
    switch(condition) {
        case 'good': return 'smile';
        case 'normal': return 'meh';
        case 'bad': return 'frown';
        default: return 'question';
    }
}

function getConditionColor(condition) {
    switch(condition) {
        case 'good': return '#4CAF50';
        case 'normal': return '#FF9800';
        case 'bad': return '#F44336';
        default: return '#757575';
    }
}

function createObjectBalloonContent(obj) {
    const conditionIcon = getConditionIcon(obj.condition);
    const conditionColor = getConditionColor(obj.condition);
    const conditionName = getConditionName(obj.condition);
    const typeName = getTypeName(obj.type);
    const typeIcon = getIconByType(obj.type);
    const typeColor = getColorByType(obj.type);
    
    return `
        <div class="balloon-content">
            <div class="balloon-header">
                <h4 style="margin: 0 0 5px 0; color: #333;">${obj.name}</h4>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span class="object-type" style="
                        background: ${typeColor};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    ">
                        <i class="fas fa-${typeIcon}" style="margin-right: 5px;"></i>${typeName}
                    </span>
                    <span style="
                        background: ${conditionColor};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    ">
                        <i class="fas fa-${conditionIcon}" style="margin-right: 5px;"></i>${conditionName}
                    </span>
                </div>
            </div>
            <div class="balloon-body" style="font-size: 14px; line-height: 1.5;">
                ${obj.description ? `
                    <p style="margin: 10px 0; color: #555;">
                        <i class="fas fa-info-circle" style="color: #2196F3; margin-right: 8px;"></i>
                        ${obj.description}
                    </p>
                ` : ''}
                
                <p style="margin: 8px 0; color: #666;">
                    <i class="fas fa-map-marker-alt" style="color: #FF9800; margin-right: 8px;"></i>
                    Координаты: ${obj.coords[0].toFixed(6)}, ${obj.coords[1].toFixed(6)}
                </p>
                
                ${obj.date ? `
                    <p style="margin: 8px 0; color: #666;">
                        <i class="fas fa-calendar" style="color: #9C27B0; margin-right: 8px;"></i>
                        Добавлено: ${formatDate(obj.date)}
                    </p>
                ` : ''}
                
                ${obj.createdBy ? `
                    <p style="margin: 8px 0; color: #666;">
                        <i class="fas fa-user" style="color: #4CAF50; margin-right: 8px;"></i>
                        Добавил: ${obj.createdBy}
                    </p>
                ` : ''}
                
                ${obj.reports && obj.reports.length > 0 ? `
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                        <p style="margin: 0 0 5px 0; color: #333; font-weight: 600;">
                            <i class="fas fa-exclamation-circle" style="color: #F44336;"></i>
                            Сообщения о проблемах: ${obj.reports.length}
                        </p>
                        ${obj.reports.slice(-2).map(report => `
                            <div style="
                                background: #fff3e0;
                                padding: 8px;
                                border-radius: 6px;
                                margin: 5px 0;
                                font-size: 13px;
                            ">
                                <strong>${formatDate(report.date)}:</strong> ${report.description.substring(0, 60)}...
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${currentUser.role === ROLES.USER ? `
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                        <button onclick="
                            selectedObject = ${JSON.stringify(obj).replace(/"/g, '&quot;')};
                            showPanel(PANEL_STATES.REPORT_FORM);
                        " style="
                            background: #F44336;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            width: 100%;
                        ">
                            <i class="fas fa-exclamation-triangle"></i> Сообщить о проблеме
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function createIssueBalloonContent(issue) {
    const statusColor = issue.status === 'approved' ? '#4CAF50' : 
                       issue.status === 'rejected' ? '#F44336' : '#FF9800';
    const statusName = getStatusName(issue.status);
    const typeName = issue.type === 'suggestion' ? 'Предложение' : 'Проблема';
    const typeIcon = issue.type === 'suggestion' ? 'lightbulb' : 'exclamation-triangle';
    const typeColor = issue.type === 'suggestion' ? '#FF9800' : '#F44336';
    
    return `
        <div class="balloon-content">
            <div class="balloon-header">
                <h4 style="margin: 0 0 5px 0; color: #333;">
                    <i class="fas fa-${typeIcon}" style="color: ${typeColor};"></i>
                    ${typeName}
                </h4>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span style="
                        background: ${statusColor};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    ">
                        ${statusName}
                    </span>
                    ${issue.urgency ? `
                        <span style="
                            background: ${issue.urgency === 'high' ? '#F44336' : 
                                       issue.urgency === 'medium' ? '#FF9800' : '#4CAF50'};
                            color: white;
                            padding: 3px 10px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: 600;
                        ">
                            ${issue.urgency === 'high' ? 'Высокая' : 
                              issue.urgency === 'medium' ? 'Средняя' : 'Низкая'} срочность
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="balloon-body" style="font-size: 14px; line-height: 1.5;">
                ${issue.objectName ? `
                    <p style="margin: 10px 0; color: #555;">
                        <i class="fas fa-tree" style="color: #2E7D32; margin-right: 8px;"></i>
                        <strong>Объект:</strong> ${issue.objectName}
                    </p>
                ` : ''}
                
                <p style="margin: 10px 0; color: #555;">
                    <i class="fas fa-comment" style="color: #2196F3; margin-right: 8px;"></i>
                    <strong>Описание:</strong> ${issue.description}
                </p>
                
                <p style="margin: 8px 0; color: #666;">
                    <i class="fas fa-user" style="color: #9C27B0; margin-right: 8px;"></i>
                    <strong>Автор:</strong> ${issue.createdByName || 'Аноним'}
                </p>
                
                <p style="margin: 8px 0; color: #666;">
                    <i class="fas fa-calendar" style="color: #FF9800; margin-right: 8px;"></i>
                    <strong>Дата:</strong> ${formatDate(issue.createdAt)}
                </p>
                
                ${issue.coords ? `
                    <p style="margin: 8px 0; color: #666;">
                        <i class="fas fa-map-marker-alt" style="color: #F44336; margin-right: 8px;"></i>
                        <strong>Координаты:</strong> ${issue.coords[0].toFixed(6)}, ${issue.coords[1].toFixed(6)}
                    </p>
                ` : ''}
                
                ${issue.response ? `
                    <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
                        <p style="margin: 0 0 5px 0; color: #333; font-weight: 600;">
                            <i class="fas fa-reply" style="color: #4CAF50;"></i>
                            Ответ специалиста:
                        </p>
                        <p style="margin: 0; color: #555; font-style: italic;">
                            "${issue.response}"
                        </p>
                        ${issue.resolvedBy ? `
                            <p style="margin: 5px 0 0 0; color: #777; font-size: 12px;">
                                — ${issue.resolvedBy}, ${formatDate(issue.resolvedAt)}
                            </p>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${currentUser.role === ROLES.SPECIALIST || currentUser.role === ROLES.ADMIN ? `
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                        <button onclick="
                            selectedIssue = ${JSON.stringify(issue).replace(/"/g, '&quot;')};
                            showPanel(PANEL_STATES.ISSUE_DETAILS);
                        " style="
                            background: #2196F3;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            width: 100%;
                        ">
                            <i class="fas fa-cog"></i> Управление заявкой
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}
function getProblemTypeName(type) {
    const types = {
        'damage': 'Повреждение',
        'disease': 'Болезнь/вредители',
        'trash': 'Скопление мусора',
        'vandalism': 'Вандализм',
        'danger': 'Опасность для людей',
        'other': 'Другое'
    };
    return types[type] || type;
}

function getUrgencyName(urgency) {
    const urgencies = {
        'low': 'Низкая',
        'medium': 'Средняя',
        'high': 'Высокая'
    };
    return urgencies[urgency] || urgency;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays === 2) return 'позавчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    // Для старых дат показываем полную дату
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
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
    setInterval(updateLastUpdateTime, 60000);
    
    // Проверяем, есть ли сохраненный пользователь
    if (currentUser.role !== ROLES.GUEST) {
        showNotification(`С возвращением, ${currentUser.name}!`, 'info');
    }
});
