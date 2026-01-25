
const CONFIG = {
    // ВАЖНО: полный базовый URL API (Render Web Service)
    API_BASE: 'https://eco-biyisk-map.onrender.com'
};

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
    ADD_OBJECT_FORM: 'add_object_form',
    POLLS_LIST: 'polls_list'
};

// Глобальные переменные
let myMap = null;
let objectCollection = null;
let issueCollection = null;
let pollCollection = null;
let selectedObject = null;
let tempPlacemark = null;

let currentUser = {
    role: ROLES.GUEST,
    name: 'Гость',
    email: '',
    id: null,
    roleCode: ''
};

let currentObjects = [];
let currentIssues = [];
let currentPolls = [];

let lastUpdateTime = null;
let updateInterval = null;

// ============================================================================
// НОРМАЛИЗАЦИЯ ДАННЫХ ИЗ API (snake_case -> camelCase)
// ============================================================================

function normalizeObjectRow(row) {
    if (!row) return row;
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        condition: row.condition,
        description: row.description,
        coords: row.coords,
        date: row.date,
        createdBy: row.created_by ?? row.createdBy ?? null,
        createdByName: row.created_by_name ?? row.createdByName ?? row.created_by ?? row.createdBy ?? null,
        createdByRole: row.created_by_role ?? row.createdByRole ?? null
    };
}

function normalizeIssueRow(row) {
    if (!row) return row;
    return {
        id: row.id,
        type: row.type,
        objectId: row.object_id ?? row.objectId ?? null,
        objectName: row.object_name ?? row.objectName ?? null,
        coords: row.coords,
        description: row.description,
        problemType: row.problem_type ?? row.problemType ?? null,
        urgency: row.urgency ?? null,
        createdBy: row.created_by ?? row.createdBy ?? null,
        createdByName: row.created_by_name ?? row.createdByName ?? row.created_by ?? row.createdBy ?? null,
        createdAt: row.created_at ?? row.createdAt ?? null,
        status: row.status ?? null,
        response: row.response ?? null,
        resolvedBy: row.resolved_by ?? row.resolvedBy ?? null,
        resolvedAt: row.resolved_at ?? row.resolvedAt ?? null,
        createdByRole: row.created_by_role ?? row.createdByRole ?? null
    };
}

function normalizePollRow(row) {
    if (!row) return row;
    return {
        id: row.id,
        question: row.question,
        options: row.options,
        createdAt: row.created_at ?? row.createdAt ?? null,
        createdBy: row.created_by ?? row.createdBy ?? null,
        createdByName: row.created_by_name ?? row.createdByName ?? row.created_by ?? row.createdBy ?? null,
        createdByRole: row.created_by_role ?? row.createdByRole ?? null
    };
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация приложения...');
    
    // Проверяем сохраненного пользователя
    loadUserFromStorage();
    
    // Инициализируем Yandex Maps
    ymaps.ready(initMap);
    
    // Настраиваем обработчики UI
    setupUIHandlers();
    
    // Запускаем обновление данных
    loadData();
    
    // Автообновление каждые 2 минуты
    updateInterval = setInterval(loadData, 120000);
});

// ============================================================================
// ФУНКЦИИ КАРТЫ
// ============================================================================

// Инициализация карты
function initMap() {
    console.log('🗺️ Инициализация карты...');
    
    // Создаем карту
    myMap = new ymaps.Map('map', {
        center: [52.5186, 85.2076],
        zoom: 13,
        controls: ['zoomControl']
    });
    
    // Настройка элементов управления
    myMap.controls.get('zoomControl').options.set({
        size: 'large',
        position: { right: 10, top: 150 }
    });

    // Создаем коллекции для объектов
    objectCollection = new ymaps.GeoObjectCollection(null, {
        preset: 'islands#blueCircleIcon'
    });
    
    issueCollection = new ymaps.GeoObjectCollection(null, {
        preset: 'islands#redCircleIcon'
    });
    
    pollCollection = new ymaps.GeoObjectCollection(null, {
        preset: 'islands#greenCircleIcon'
    });
    
    // Добавляем коллекции на карту
    myMap.geoObjects.add(objectCollection);
    myMap.geoObjects.add(issueCollection);
    myMap.geoObjects.add(pollCollection);
    
    // Обновляем карту с данными
    updateMapObjects();
    
    console.log('✅ Карта инициализирована');
}

// Создание метки объекта на карте
function createObject(obj) {
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
            showPanel(PANEL_STATES.SPECIALIST_DASHBOARD);
        }
    });
    
    return placemark;
}

// Создание метки заявки на карте
function createIssue(issue) {
    const placemark = new ymaps.Placemark(
        issue.coords,
        {
            balloonContent: createIssueBalloonContent(issue),
            hintContent: `Заявка: ${issue.problemType || 'Проблема'}`,
            issueId: issue.id,
            objectType: 'issue'
        },
        {
            preset: 'islands#circleIcon',
            iconColor: getIssueColor(issue.status),
            iconGlyph: 'exclamation',
            balloonCloseButton: true
        }
    );
    
    return placemark;
}

// Создание метки голосования на карте
function createPollMarker(poll) {
    // Для MVP голосования без геопозиции в БД — ставим в центр города
    const placemark = new ymaps.Placemark(
        [52.5186, 85.2076],
        {
            balloonContent: createPollBalloonContent(poll),
            hintContent: `Голосование`,
            pollId: poll.id,
            objectType: 'poll'
        },
        {
            preset: 'islands#circleIcon',
            iconColor: '#4CAF50',
            iconGlyph: 'check',
            balloonCloseButton: true
        }
    );
    
    return placemark;
}

// Обновление объектов на карте
function updateMapObjects() {
    if (!myMap || !objectCollection) return;
    
    // Очищаем коллекции
    objectCollection.removeAll();
    issueCollection.removeAll();
    pollCollection.removeAll();
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        const placemark = createObject(obj);
        objectCollection.add(placemark);
    });
    
    // Добавляем заявки
    currentIssues.forEach(issue => {
        const placemark = createIssue(issue);
        issueCollection.add(placemark);
    });
    
    // Добавляем голосования (маркеры условные)
    currentPolls.forEach(poll => {
        const placemark = createPollMarker(poll);
        pollCollection.add(placemark);
    });
    
    console.log(`🗺️ Карта обновлена: ${currentObjects.length} объектов, ${currentIssues.length} заявок, ${currentPolls.length} голосований`);
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

async function loadData() {
    try {
        showNotification('Обновляем данные...', 'info');

        const apiBase = CONFIG.API_BASE || '';
        const apiUrl = `${apiBase}/api/data?t=${Date.now()}`;
        const response = await fetch(apiUrl, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Нормализуем поля из БД (snake_case -> camelCase)
        currentObjects = (data.objects || []).map(normalizeObjectRow);
        currentIssues = (data.issues || []).map(normalizeIssueRow);
        currentPolls = (data.polls || []).map(normalizePollRow);

        // Обновляем карту и интерфейс
        updateMapObjects();
        updateStatistics();

        lastUpdateTime = new Date();
        updateLastUpdateTime();

        console.log(`✅ Данные обновлены: ${currentObjects.length} объектов, ${currentIssues.length} заявок, ${currentPolls.length} голосований`);
        showNotification('Данные обновлены', 'success');

    } catch (error) {
        console.error('❌ Ошибка загрузки данных из API:', error);
        // Для prod-MVP: не подменяем серверные данные демо-наборами
        currentObjects = [];
        currentIssues = [];
        currentPolls = [];

        updateMapObjects();
        updateStatistics();

        lastUpdateTime = new Date();
        updateLastUpdateTime();

        showNotification('Не удалось загрузить данные с сервера. Попробуйте позже.', 'error');
    }
}

// ============================================================================
// UI И ПАНЕЛИ
// ============================================================================

// Настройка обработчиков UI
function setupUIHandlers() {
    // Кнопка меню (панель)
    document.getElementById('menuBtn').addEventListener('click', togglePanel);
    
    // Кнопка обновления
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    
    // Кнопки панели
    document.getElementById('closePanel').addEventListener('click', () => {
        document.querySelector('.side-panel').classList.remove('open');
    });
    
    // Загружаем панель по умолчанию
    showPanel(PANEL_STATES.DEFAULT);
    
    // Обновляем UI в зависимости от роли
    updateUserInterface();
}

// Показать/скрыть панель
function togglePanel() {
    document.querySelector('.side-panel').classList.toggle('open');
}

// Показать определенную панель
function showPanel(state, data = null) {
    const panelTitle = document.getElementById('panelTitle');
    const panelContent = document.getElementById('panelContent');
    
    // Очищаем временную метку, если она есть
    if (tempPlacemark) {
        myMap.geoObjects.remove(tempPlacemark);
        tempPlacemark = null;
    }
    
    switch(state) {
        case PANEL_STATES.DEFAULT:
            panelTitle.innerHTML = '<i class="fas fa-leaf"></i> ЭкоКарта Бийска';
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
            loadSuggestionForm();
            break;
            
        case PANEL_STATES.ADD_OBJECT_FORM:
            panelTitle.innerHTML = '<i class="fas fa-plus"></i> Добавить объект';
            loadAddObjectForm();
            break;
            
        case PANEL_STATES.POLLS_LIST:
            panelTitle.innerHTML = '<i class="fas fa-poll"></i> Голосования';
            loadPollsList();
            break;
    }
    
    // Открываем панель
    document.querySelector('.side-panel').classList.add('open');
}

// Панель по умолчанию
function loadDefaultPanel() {
    const panelContent = document.getElementById('panelContent');
    
    let actions = '';
    
    // Действия в зависимости от роли
    if (currentUser.role === ROLES.GUEST) {
        actions = `
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.LOGIN}')">
                <i class="fas fa-sign-in-alt"></i>
                <span>Войти</span>
            </button>
        `;
    } else if (currentUser.role === ROLES.USER) {
        actions = `
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.SUGGESTION_FORM}')">
                <i class="fas fa-lightbulb"></i>
                <span>Предложить идею</span>
            </button>
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.POLLS_LIST}')">
                <i class="fas fa-poll"></i>
                <span>Голосования</span>
            </button>
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.USER_DASHBOARD}')">
                <i class="fas fa-user"></i>
                <span>Личный кабинет</span>
            </button>
            <button class="action-btn secondary" onclick="showPanel('${PANEL_STATES.LOGIN}', '${ROLES.USER}')">
                <i class="fas fa-exchange-alt"></i>
                <span>Смена роли</span>
            </button>
        `;
    } else if (currentUser.role === ROLES.SPECIALIST) {
        actions = `
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.ADD_OBJECT_FORM}')">
                <i class="fas fa-plus"></i>
                <span>Добавить объект</span>
            </button>
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.SPECIALIST_DASHBOARD}')">
                <i class="fas fa-user-tie"></i>
                <span>Кабинет специалиста</span>
            </button>
            <button class="action-btn secondary" onclick="showPanel('${PANEL_STATES.LOGIN}', '${ROLES.SPECIALIST}')">
                <i class="fas fa-exchange-alt"></i>
                <span>Смена роли</span>
            </button>
        `;
    } else if (currentUser.role === ROLES.ADMIN) {
        actions = `
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.ADD_OBJECT_FORM}')">
                <i class="fas fa-plus"></i>
                <span>Добавить объект</span>
            </button>
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.POLLS_LIST}')">
                <i class="fas fa-poll"></i>
                <span>Голосования</span>
            </button>
            <button class="action-btn" onclick="showPanel('${PANEL_STATES.ADMIN_DASHBOARD}')">
                <i class="fas fa-user-shield"></i>
                <span>Панель администратора</span>
            </button>
            <button class="action-btn secondary" onclick="showPanel('${PANEL_STATES.LOGIN}', '${ROLES.ADMIN}')">
                <i class="fas fa-exchange-alt"></i>
                <span>Смена роли</span>
            </button>
        `;
    }
    
    panelContent.innerHTML = `
        <div class="default-panel">
            <div class="user-info">
                <div class="user-avatar">
                    <i class="fas ${getUserIcon()}"></i>
                </div>
                <div class="user-details">
                    <h3>${currentUser.name}</h3>
                    <p>${getRoleName(currentUser.role)}</p>
                </div>
            </div>
            
            <div class="stats">
                <div class="stat-item">
                    <span class="stat-value">${currentObjects.length}</span>
                    <span class="stat-label">Объектов</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${currentIssues.length}</span>
                    <span class="stat-label">Заявок</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${currentPolls.length}</span>
                    <span class="stat-label">Голосований</span>
                </div>
            </div>
            
            <div class="actions">
                ${actions}
            </div>
            
            <div class="update-info">
                <small>Последнее обновление: <span id="lastUpdateTime">${getLastUpdateText()}</span></small>
            </div>
        </div>
    `;
}

// Панель входа/смены роли
function loadLoginPanel(selectedRole = ROLES.USER) {
    const panelContent = document.getElementById('panelContent');

    const content = `
        <div class="login-form">
            <div class="form-group">
                <label for="loginName">Имя (обязательно):</label>
                <input type="text" id="loginName" class="form-input" placeholder="Например: Иван" minlength="2" maxlength="40">
            </div>

            <div class="form-group">
                <label for="loginEmail">Email (необязательно):</label>
                <input type="email" id="loginEmail" class="form-input" placeholder="your@email.com">
            </div>

            <div class="form-group" id="loginCodeGroup" style="display:none;">
                <label for="loginCode">Код доступа (для специалиста/админа):</label>
                <input type="password" id="loginCode" class="form-input" placeholder="Введите код доступа">
                <div class="hint small">Код нужен только для ролей «Специалист» и «Администратор».</div>
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
                <button class="btn btn--primary" id="submitLogin">Войти</button>
            </div>

            <div class="login-hint">
                <p><strong>Пользователь:</strong> может предлагать идеи/сообщать о проблемах, участвовать в голосованиях.</p>
                <p><strong>Специалист:</strong> может добавлять объекты (нужен код).</p>
                <p><strong>Администратор:</strong> может создавать голосования (нужен код).</p>
            </div>
        </div>
    `;

    panelContent.innerHTML = content;

    const loginEmailInput = document.getElementById('loginEmail');
    const loginNameInput = document.getElementById('loginName');
    const loginCodeGroup = document.getElementById('loginCodeGroup');
    const loginCodeInput = document.getElementById('loginCode');

    // Заполняем из текущего пользователя
    if (currentUser.role !== ROLES.GUEST) {
        if (loginEmailInput) loginEmailInput.value = currentUser.email || '';
        if (loginNameInput) loginNameInput.value = currentUser.name || '';
        if (loginCodeInput && (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.SPECIALIST)) {
            loginCodeInput.value = currentUser.roleCode || '';
        }
    }

    function updateCodeVisibility() {
        const role = document.querySelector('.login-type-btn.active')?.dataset?.role || 'user';
        if (role === 'admin' || role === 'specialist') {
            loginCodeGroup.style.display = 'block';
        } else {
            loginCodeGroup.style.display = 'none';
            if (loginCodeInput) loginCodeInput.value = '';
        }
    }

    // Обработчики для выбора роли
    document.querySelectorAll('.login-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.login-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateCodeVisibility();
        });
    });

    // Выставляем роль по умолчанию
    const initialBtn = document.querySelector(`.login-type-btn[data-role="${selectedRole}"]`)
        || document.querySelector('.login-type-btn[data-role="user"]');
    if (initialBtn) initialBtn.classList.add('active');

    updateCodeVisibility();

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
                <label>Тип проблемы:</label>
                <select id="problemType" class="form-select">
                    <option value="Повреждение">Повреждение</option>
                    <option value="Мусор">Мусор</option>
                    <option value="Засуха">Засуха</option>
                    <option value="Вандализм">Вандализм</option>
                    <option value="Другое">Другое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Срочность:</label>
                <select id="urgency" class="form-select">
                    <option value="Низкая">Низкая</option>
                    <option value="Средняя">Средняя</option>
                    <option value="Высокая">Высокая</option>
                    <option value="Критическая">Критическая</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Описание проблемы:</label>
                <textarea id="problemDescription" class="form-textarea" placeholder="Опишите проблему подробно..."></textarea>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Отмена</button>
                <button class="btn btn--primary" id="submitReport">Отправить</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    document.getElementById('submitReport').addEventListener('click', function() {
        const report = {
            type: 'problem',
            objectId: obj.id,
            objectName: obj.name,
            coords: obj.coords,
            problemType: document.getElementById('problemType').value,
            urgency: document.getElementById('urgency').value,
            description: document.getElementById('problemDescription').value,
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        submitIssue(report).catch(() => {});
    });
}

function loadSpecialistDashboard() {
    const panelContent = document.getElementById('panelContent');
    const pendingIssues = currentIssues.filter(issue => issue.status === 'pending' || issue.status === 'open');
    
    let content = `
        <div class="specialist-dashboard">
            <h4>Заявки на рассмотрение (${pendingIssues.length})</h4>
            <div class="issues-list">
    `;
    
    if (pendingIssues.length === 0) {
        content += `<p class="no-data">Нет заявок на рассмотрение</p>`;
    } else {
        pendingIssues.forEach(issue => {
            content += `
                <div class="issue-card">
                    <div class="issue-header">
                        <span class="issue-type">${issue.problemType || 'Проблема'}</span>
                        <span class="issue-urgency urgency-${(issue.urgency || 'Низкая').toLowerCase()}">${issue.urgency || 'Низкая'}</span>
                    </div>
                    <p class="issue-description">${issue.description}</p>
                    <div class="issue-meta">
                        <small>От: ${issue.createdByName || 'Аноним'}</small>
                        <small>${formatDate(issue.createdAt || issue.createdAt)}</small>
                    </div>
                    <div class="issue-actions">
                        <button class="btn btn--small" onclick="focusOnIssue('${issue.id}')">
                            <i class="fas fa-map-marker-alt"></i> На карте
                        </button>
                        <button class="btn btn--small btn--primary" onclick="showIssueResponseForm('${issue.id}')">
                            <i class="fas fa-reply"></i> Ответить
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    content += `
            </div>
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Назад</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

function loadAdminDashboard() {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="admin-dashboard">
            <h4>Панель администратора</h4>
            
            <div class="admin-actions">
                <button class="action-btn" onclick="showCreatePollForm()">
                    <i class="fas fa-plus"></i>
                    <span>Создать голосование</span>
                </button>
                
                <button class="action-btn" onclick="showPanel('${PANEL_STATES.ADD_OBJECT_FORM}')">
                    <i class="fas fa-tree"></i>
                    <span>Добавить объект</span>
                </button>
                
                <button class="action-btn" onclick="showPanel('${PANEL_STATES.SPECIALIST_DASHBOARD}')">
                    <i class="fas fa-tasks"></i>
                    <span>Заявки</span>
                </button>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Назад</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

function loadUserDashboard() {
    const panelContent = document.getElementById('panelContent');
    
    const userIssues = currentIssues.filter(issue => (issue.createdByName || '').toLowerCase() === (currentUser.name || '').toLowerCase());
    const userPolls = currentPolls.filter(poll => (poll.createdByName || poll.createdBy || '').toLowerCase() === (currentUser.name || '').toLowerCase());
    
    const content = `
        <div class="user-dashboard">
            <h4>Мои действия</h4>
            
            <div class="dashboard-section">
                <h5>Мои заявки (${userIssues.length})</h5>
                <p class="hint">Заявки, отправленные от вашего имени (по имени пользователя).</p>
                <button class="btn btn--small" onclick="showUserIssues()">
                    <i class="fas fa-list"></i> Посмотреть
                </button>
            </div>
            
            <div class="dashboard-section">
                <h5>Созданные голосования (${userPolls.length})</h5>
                <button class="btn btn--small" onclick="showPanel('${PANEL_STATES.POLLS_LIST}')">
                    <i class="fas fa-poll"></i> Открыть
                </button>
            </div>
            
            <div class="dashboard-section">
                <button class="btn btn--secondary" onclick="logoutUser()">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Назад</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

// ============================================================================
// ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================================

function handleLogin() {
    const email = (document.getElementById('loginEmail')?.value || '').trim();
    const nameField = (document.getElementById('loginName')?.value || '').trim();
    const role = document.querySelector('.login-type-btn.active')?.dataset?.role || 'user';
    const roleCode = (document.getElementById('loginCode')?.value || '').trim();

    // Имя обязательно для всех ролей
    if (!nameField || nameField.length < 2) {
        showNotification('Введите имя (минимум 2 символа)', 'warning');
        return;
    }

    if (role === 'user') {
        currentUser = {
            role: ROLES.USER,
            name: nameField,
            email: email,
            id: 'user_' + Date.now(),
            roleCode: ''
        };
    } else if (role === 'specialist') {
        if (!roleCode) {
            showNotification('Для роли «Специалист» нужен код доступа', 'warning');
            return;
        }
        currentUser = {
            role: ROLES.SPECIALIST,
            name: nameField,
            email: email,
            id: 'specialist_' + Date.now(),
            roleCode: roleCode
        };
    } else if (role === 'admin') {
        if (!roleCode) {
            showNotification('Для роли «Администратор» нужен код доступа', 'warning');
            return;
        }
        currentUser = {
            role: ROLES.ADMIN,
            name: nameField,
            email: email,
            id: 'admin_' + Date.now(),
            roleCode: roleCode
        };
    }

    // Сохраняем пользователя локально (только для удобства на этом устройстве)
    localStorage.setItem('eco_biysk_user', JSON.stringify(currentUser));

    updateUserInterface();
    showPanel(PANEL_STATES.DEFAULT);
    showNotification(`Добро пожаловать, ${currentUser.name}!`, 'success');

    // Обновим данные (на случай, если пользователь вошёл и хочет сразу видеть актуальное)
    loadData();
}

function logoutUser() {
    currentUser = {
        role: ROLES.GUEST,
        name: 'Гость',
        email: '',
        id: null,
        roleCode: ''
    };
    
    localStorage.removeItem('eco_biysk_user');
    updateUserInterface();
    showPanel(PANEL_STATES.DEFAULT);
    showNotification('Вы вышли из системы', 'info');
}

function loadUserFromStorage() {
    const savedUser = localStorage.getItem('eco_biysk_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('👤 Пользователь загружен:', currentUser);
        } catch (e) {
            console.error('Ошибка загрузки пользователя:', e);
        }
    }
}

// Отправка заявки/идеи на сервер
async function submitIssue(issue) {
    try {
        const apiBase = CONFIG.API_BASE || '';
        const payload = {
            description: issue.description,
            coords: issue.coords,
            urgency: issue.urgency,
            problemType: issue.problemType,
            createdByName: currentUser.name,
            roleCode: currentUser.roleCode || ''
        };

        const res = await fetch(`${apiBase}/api/issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error || body.message || `HTTP ${res.status}`);
        }

        showNotification('Заявка отправлена', 'success');
        showPanel(PANEL_STATES.DEFAULT);

        // Обновляем данные с сервера, чтобы все пользователи видели одно и то же
        await loadData();

        return body;
    } catch (e) {
        console.error('❌ submitIssue error:', e);
        showNotification(`Не удалось отправить заявку: ${e.message}`, 'error');
        throw e;
    }
}

function showUserIssues() {
    const userIssues = currentIssues.filter(issue => (issue.createdByName || '').toLowerCase() === (currentUser.name || '').toLowerCase());
    
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
                    <div class="issue-header">
                        <span class="issue-type">${issue.problemType || 'Проблема'}</span>
                        <span class="issue-status status-${issue.status || 'open'}">${getStatusName(issue.status || 'open')}</span>
                    </div>
                    <p class="issue-description">${issue.description}</p>
                    <div class="issue-meta">
                        <small>${formatDate(issue.createdAt || issue.createdAt)}</small>
                    </div>
                </div>
            `;
        });
    }
    
    content += `
            </div>
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.USER_DASHBOARD}')">Назад</button>
            </div>
        </div>
    `;
    
    document.getElementById('panelContent').innerHTML = content;
}

// ============================================================================
// ФОРМА ПРЕДЛОЖЕНИЯ ИДЕИ
// ============================================================================

function loadSuggestionForm() {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="suggestion-form">
            <div class="form-group">
                <label>Тип предложения:</label>
                <select id="suggestionType" class="form-select">
                    <option value="Идея">Идея по улучшению</option>
                    <option value="Жалоба">Жалоба</option>
                    <option value="Предложение">Предложение</option>
                    <option value="Другое">Другое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Описание:</label>
                <textarea id="suggestionDescription" class="form-textarea" placeholder="Опишите ваше предложение..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Место (на карте):</label>
                <p class="hint">Нажмите "Взять с карты" и кликните по месту</p>
                <div class="coords-inputs">
                    <input type="text" id="suggestionLat" class="form-input" placeholder="Широта" readonly>
                    <input type="text" id="suggestionLng" class="form-input" placeholder="Долгота" readonly>
                </div>
                <button class="btn btn--small" id="getCoordsFromMap">
                    <i class="fas fa-map-marker-alt"></i> Взять с карты
                </button>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Отмена</button>
                <button class="btn btn--primary" id="submitSuggestion">Отправить</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
    
    // Получение координат с карты
    document.getElementById('getCoordsFromMap').addEventListener('click', function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-mouse-pointer"></i> Кликните на карту...';
        
        const clickHandler = function(e) {
            const coords = e.get('coords');
            document.getElementById('suggestionLat').value = coords[0].toFixed(6);
            document.getElementById('suggestionLng').value = coords[1].toFixed(6);
            
            // Создаем временную метку
            if (tempPlacemark) {
                myMap.geoObjects.remove(tempPlacemark);
            }
            
            tempPlacemark = new ymaps.Placemark(coords, {
                hintContent: 'Место предложения'
            }, {
                preset: 'islands#yellowCircleIcon'
            });
            
            myMap.geoObjects.add(tempPlacemark);
            
            document.getElementById('getCoordsFromMap').disabled = false;
            document.getElementById('getCoordsFromMap').innerHTML = '<i class="fas fa-map-marker-alt"></i> Взять с карты';
            myMap.events.remove('click', clickHandler);
            
            showNotification('Место выбрано', 'success');
        };
        
        myMap.events.add('click', clickHandler);
        showNotification('Кликните на карту, чтобы выбрать место', 'info');
    });
    
    // Отправка предложения
    document.getElementById('submitSuggestion').addEventListener('click', function() {
        const lat = document.getElementById('suggestionLat').value;
        const lng = document.getElementById('suggestionLng').value;
        
        if (!lat || !lng) {
            showNotification('Выберите место на карте', 'warning');
            return;
        }
        
        const suggestion = {
            type: 'suggestion',
            coords: [parseFloat(lat), parseFloat(lng)],
            problemType: document.getElementById('suggestionType').value,
            urgency: 'Низкая',
            description: document.getElementById('suggestionDescription').value,
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        // Отправляем
        submitIssue(suggestion).catch(() => {});
        
        // Удаляем временную метку
        if (tempPlacemark) {
            myMap.geoObjects.remove(tempPlacemark)
            tempPlacemark = null;
        }
    });
}

// ============================================================================
// ДОБАВЛЕНИЕ ОБЪЕКТА (специалист/админ)
// ============================================================================

function loadAddObjectForm() {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="add-object-form">
            <div class="form-group">
                <label>Название объекта:</label>
                <input type="text" id="objectName" class="form-input" placeholder="Например: Парк Победы">
            </div>
            
            <div class="form-group">
                <label>Тип объекта:</label>
                <select id="objectType" class="form-select">
                    <option value="park">Парк</option>
                    <option value="tree">Дерево</option>
                    <option value="garden">Сад</option>
                    <option value="square">Сквер</option>
                    <option value="other">Другое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Состояние:</label>
                <select id="objectCondition" class="form-select">
                    <option value="good">Хорошее</option>
                    <option value="fair">Удовлетворительное</option>
                    <option value="poor">Плохое</option>
                    <option value="critical">Критическое</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Описание:</label>
                <textarea id="objectDescription" class="form-textarea" placeholder="Описание объекта..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Координаты:</label>
                <div class="coords-inputs">
                    <input type="text" id="objectLat" class="form-input" placeholder="Широта">
                    <input type="text" id="objectLng" class="form-input" placeholder="Долгота">
                </div>
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
    document.getElementById('submitObject').addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;

        const newObject = {
            name: document.getElementById('objectName').value,
            type: document.getElementById('objectType').value,
            description: document.getElementById('objectDescription').value,
            condition: document.getElementById('objectCondition').value,
            coords: [
                parseFloat(document.getElementById('objectLat').value),
                parseFloat(document.getElementById('objectLng').value)
            ]
        };

        if (!newObject.name.trim()) {
            showNotification('Введите название объекта', 'warning');
            btn.disabled = false;
            return;
        }

        // Для specialist/admin отправляем на сервер
        try {
            const apiBase = CONFIG.API_BASE || '';
            const payload = {
                ...newObject,
                createdByName: currentUser.name,
                roleCode: currentUser.roleCode || ''
            };

            const res = await fetch(`${apiBase}/api/objects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || body.message || `HTTP ${res.status}`);
            }

            showNotification('Объект успешно добавлен!', 'success');
            showPanel(PANEL_STATES.DEFAULT);

            await loadData();
        } catch (e) {
            console.error('❌ create object error:', e);
            showNotification(`Не удалось добавить объект: ${e.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    });
}

// ============================================================================
// ГОЛОСОВАНИЯ
// ============================================================================

function loadPollsList() {
    const panelContent = document.getElementById('panelContent');
    
    let content = `
        <div class="polls-list">
            <div class="polls-header">
                <h4>Активные голосования (${currentPolls.length})</h4>
    `;
    
    if (currentUser.role === ROLES.ADMIN) {
        content += `
                <button class="btn btn--small btn--primary" onclick="showCreatePollForm()">
                    <i class="fas fa-plus"></i> Создать
                </button>
        `;
    }
    
    content += `
            </div>
            
            <div class="polls-container">
    `;
    
    if (currentPolls.length === 0) {
        content += `<p class="no-data">Нет активных голосований</p>`;
    } else {
        currentPolls.forEach(poll => {
            content += `
                <div class="poll-card">
                    <h5>${poll.question}</h5>
                    <div class="poll-options">
            `;
            
            if (Array.isArray(poll.options)) {
                poll.options.forEach((option, index) => {
                    const label = typeof option === 'string' ? option : option.text;
                    const votes = typeof option === 'string' ? 0 : (option.votes || 0);
                    content += `
                        <button class="poll-option" onclick="voteInPoll('${poll.id}', ${index})">
                            <span>${label}</span>
                            <span class="votes">${votes}</span>
                        </button>
                    `;
                });
            }
            
            content += `
                    </div>
                    <div class="poll-meta">
                        <small>Создал: ${poll.createdByName || poll.createdBy || '—'}</small>
                        <small>${formatDate(poll.createdAt)}</small>
                    </div>
                </div>
            `;
        });
    }
    
    content += `
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.DEFAULT}')">Назад</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

function showCreatePollForm() {
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="create-poll-form">
            <div class="form-group">
                <label>Вопрос:</label>
                <input type="text" id="pollQuestion" class="form-input" placeholder="Ваш вопрос...">
            </div>
            
            <div class="form-group">
                <label>Варианты ответов (каждый с новой строки):</label>
                <textarea id="pollOptions" class="form-textarea" placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3"></textarea>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.POLLS_LIST}')">Отмена</button>
                <button class="btn btn--primary" id="createPollBtn" onclick="createPoll()">Создать</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

async function createPoll() {
    const question = document.getElementById('pollQuestion').value;
    const optionsText = document.getElementById('pollOptions').value;

    if (!question.trim() || !optionsText.trim()) {
        showNotification('Заполните все поля', 'warning');
        return;
    }

    const options = optionsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

    if (options.length < 2) {
        showNotification('Добавьте минимум 2 варианта ответа', 'warning');
        return;
    }

    // MVP: храним варианты как объекты (чтобы UI мог показывать голоса), но голоса глобально
    // будут корректны только после добавления серверного эндпоинта /vote.
    const poll = {
        question: question.trim(),
        options: options.map(option => ({ text: option, votes: 0 }))
    };

    const btn = document.getElementById('createPollBtn');
    if (btn) btn.disabled = true;

    try {
        const apiBase = CONFIG.API_BASE || '';
        const payload = {
            ...poll,
            createdByName: currentUser.name,
            roleCode: currentUser.roleCode || ''
        };

        const res = await fetch(`${apiBase}/api/polls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error || body.message || `HTTP ${res.status}`);
        }

        showNotification('Голосование создано', 'success');

        // Очищаем форму
        document.getElementById('pollQuestion').value = '';
        document.getElementById('pollOptions').value = '';

        // Обновляем данные
        await loadData();

        showPanel(PANEL_STATES.DEFAULT);
    } catch (e) {
        console.error('❌ createPoll error:', e);
        showNotification(`Не удалось создать голосование: ${e.message}`, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function voteInPoll(pollId, optionIndex) {
    const poll = currentPolls.find(p => p.id === pollId);
    if (!poll) return;
    
    if (!Array.isArray(poll.options) || !poll.options[optionIndex]) return;

    // Поддержка и строк, и объектов
    if (typeof poll.options[optionIndex] === 'string') {
        // Превращаем в объект на лету, чтобы UI показал счетчик
        poll.options[optionIndex] = { text: poll.options[optionIndex], votes: 1 };
    } else {
        poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
    }
    
    // MVP: голосование сейчас учитывается локально на этом устройстве.
    // Чтобы голоса были общими для всех, нужен серверный эндпоинт /api/polls/:id/vote.
    
    showNotification('Ваш голос учтен (локально, MVP)', 'success');
    loadPollsList();
}

// ============================================================================
// СПЕЦИАЛИСТ: НА КАРТУ И ОТВЕТ
// ============================================================================

function focusOnIssue(issueId) {
    const issue = currentIssues.find(i => String(i.id) === String(issueId));
    if (!issue) return;
    
    myMap.setCenter(issue.coords, 16);
    showNotification('Переход к заявке на карте', 'info');
}

function showIssueResponseForm(issueId) {
    const issue = currentIssues.find(i => String(i.id) === String(issueId));
    if (!issue) return;
    
    const panelContent = document.getElementById('panelContent');
    
    const content = `
        <div class="issue-response-form">
            <h4>Ответ на заявку</h4>
            <div class="issue-details">
                <p><strong>Тип:</strong> ${issue.problemType || 'Проблема'}</p>
                <p><strong>Описание:</strong> ${issue.description}</p>
                <p><strong>От:</strong> ${issue.createdByName || 'Аноним'}</p>
            </div>
            
            <div class="form-group">
                <label>Статус:</label>
                <select id="issueStatus" class="form-select">
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решено</option>
                    <option value="rejected">Отклонено</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Ответ:</label>
                <textarea id="issueResponse" class="form-textarea" placeholder="Ваш ответ..."></textarea>
            </div>
            
            <div class="form-actions">
                <button class="btn btn--secondary" onclick="showPanel('${PANEL_STATES.SPECIALIST_DASHBOARD}')">Отмена</button>
                <button class="btn btn--primary" onclick="submitIssueResponse('${issueId}')">Отправить</button>
            </div>
        </div>
    `;
    
    panelContent.innerHTML = content;
}

// MVP: серверных эндпоинтов для обновления заявок пока нет.
// Эта функция оставлена для будущего расширения.
function submitIssueResponse(issueId) {
    showNotification('В MVP обновление статуса заявок пока не реализовано на сервере.', 'warning');
    showPanel(PANEL_STATES.SPECIALIST_DASHBOARD);
}

// ============================================================================
// УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

function updateUserInterface() {
    // Обновляем иконку/имя в шапке если есть
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = currentUser.name || 'Гость';
    }
}

function updateStatistics() {
    // Статистика обновляется внутри default panel, если она открыта.
    // Для MVP достаточно — при открытии панели цифры берутся из currentObjects/currentIssues/currentPolls.
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdateTime');
    if (el) el.textContent = getLastUpdateText();
}

function getLastUpdateText() {
    if (!lastUpdateTime) return '—';
    return `${lastUpdateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) {
        console.log(`[${type}] ${message}`);
        return;
    }
    
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function getUserIcon() {
    switch (currentUser.role) {
        case ROLES.USER: return 'fa-user';
        case ROLES.SPECIALIST: return 'fa-user-tie';
        case ROLES.ADMIN: return 'fa-user-shield';
        default: return 'fa-user-circle';
    }
}

function getRoleName(role) {
    switch (role) {
        case ROLES.USER: return 'Пользователь';
        case ROLES.SPECIALIST: return 'Специалист';
        case ROLES.ADMIN: return 'Администратор';
        default: return 'Гость';
    }
}

function getColorByType(type) {
    const colors = {
        park: '#4CAF50',
        tree: '#2E7D32',
        garden: '#81C784',
        square: '#66BB6A',
        other: '#9E9E9E'
    };
    return colors[type] || colors.other;
}

function getIconByType(type) {
    const icons = {
        park: 'tree',
        tree: 'leaf',
        garden: 'seedling',
        square: 'park',
        other: 'map-marker-alt'
    };
    return icons[type] || icons.other;
}

function getTypeName(type) {
    const names = {
        park: 'Парк',
        tree: 'Дерево',
        garden: 'Сад',
        square: 'Сквер',
        other: 'Другое'
    };
    return names[type] || names.other;
}

function getIssueColor(status) {
    const colors = {
        pending: '#FF9800',
        open: '#FF9800',
        in_progress: '#2196F3',
        resolved: '#4CAF50',
        rejected: '#9E9E9E'
    };
    return colors[status] || '#FF9800';
}

function getStatusName(status) {
    const names = {
        pending: 'Ожидает',
        open: 'Ожидает',
        in_progress: 'В работе',
        resolved: 'Решено',
        rejected: 'Отклонено'
    };
    return names[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function createObjectBalloonContent(obj) {
    return `
        <div class="balloon-content">
            <h4>${obj.name}</h4>
            <p><strong>Тип:</strong> ${getTypeName(obj.type)}</p>
            <p><strong>Состояние:</strong> ${obj.condition || '—'}</p>
            <p>${obj.description || ''}</p>
            <hr>
            <p><small>Добавил: ${obj.createdByName || obj.createdBy || '—'}</small></p>
            ${currentUser.role === ROLES.USER ? `<button class="btn btn--small btn--primary" onclick="showPanel('${PANEL_STATES.REPORT_FORM}')">Сообщить о проблеме</button>` : ''}
        </div>
    `;
}

function createIssueBalloonContent(issue) {
    return `
        <div class="balloon-content">
            <h4>Заявка</h4>
            <p><strong>Тип:</strong> ${issue.problemType || 'Проблема'}</p>
            <p><strong>Срочность:</strong> ${issue.urgency || '—'}</p>
            <p>${issue.description || ''}</p>
            <p><strong>Статус:</strong> ${getStatusName(issue.status || 'open')}</p>
            <hr>
            <p><small>От: ${issue.createdByName || '—'}</small></p>
        </div>
    `;
}

function createPollBalloonContent(poll) {
    return `
        <div class="balloon-content">
            <h4>Голосование</h4>
            <p>${poll.question || ''}</p>
            <p><small>Создал: ${poll.createdByName || poll.createdBy || '—'}</small></p>
        </div>
    `;
}

// MVP: данные хранятся на сервере (PostgreSQL). Локальное сохранение отключено.
function saveIssuesLocally() {
    // MVP: данные хранятся на сервере (PostgreSQL). Локальное сохранение отключено.
}
