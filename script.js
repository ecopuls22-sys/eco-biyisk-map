// Основной файл с обновленной логикой

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================
const CONFIG = {
    GITHUB_USERNAME: 'ecopuls22-sys',
    REPO_NAME: 'eco-biyisk-map',
    DATA_FILES: {
        objects: 'data/objects.json',
        problems: 'data/problems.json',
        ideas: 'data/ideas.json',
        votes: 'data/votes.json'
    }
};

// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================================
let myMap;
let currentObjects = [];
let currentProblems = [];
let currentScreen = 'map';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================
ymaps.ready(async function init() {
    console.log('🌳 Умный город Бийск - Загрузка...');
    
    // Создаем карту
    myMap = new ymaps.Map('map', {
        center: [52.5186, 85.2076],
        zoom: 13,
        controls: ['zoomControl', 'fullscreenControl']
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
    await loadAllData();
    
    // Инициализация интерфейса
    initializeUI();
    
    console.log('✅ Система готова!');
});

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================
async function loadAllData() {
    await Promise.all([
        loadObjects(),
        loadProblems()
    ]);
    
    updateStatistics();
}

async function loadObjects() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.objects);
        const response = await fetch(url);
        
        if (response.ok) {
            currentObjects = await response.json();
            renderObjectsOnMap();
        }
    } catch (error) {
        console.error('Ошибка загрузки объектов:', error);
        currentObjects = getDefaultObjects();
        renderObjectsOnMap();
    }
}

async function loadProblems() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.problems);
        const response = await fetch(url);
        
        if (response.ok) {
            currentProblems = await response.json();
            renderProblemsOnMap();
        }
    } catch (error) {
        console.error('Ошибка загрузки проблем:', error);
        currentProblems = getDefaultProblems();
        renderProblemsOnMap();
    }
}

function buildDataUrl(filePath) {
    return `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/main/${filePath}?t=${Date.now()}`;
}

// ============================================================================
// РАБОТА С КАРТОЙ
// ============================================================================
function renderObjectsOnMap() {
    // Очищаем старые объекты
    myMap.geoObjects.removeAll();
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        addObjectToMap(obj);
    });
    
    // Добавляем проблемы
    currentProblems.forEach(problem => {
        addProblemToMap(problem);
    });
}

function addObjectToMap(obj) {
    const placemark = createPlacemark(obj.coords, {
        content: createObjectBalloon(obj),
        hint: obj.name
    }, {
        preset: 'islands#circleIcon',
        iconColor: getColorByType(obj.type),
        iconGlyph: getIconByType(obj.type)
    });
    
    myMap.geoObjects.add(placemark);
}

function addProblemToMap(problem) {
    const placemark = createPlacemark(problem.location, {
        content: createProblemBalloon(problem),
        hint: problem.title
    }, {
        preset: 'islands#circleIcon',
        iconColor: getProblemColor(problem.status),
        iconGlyph: 'exclamation'
    });
    
    myMap.geoObjects.add(placemark);
}

function createPlacemark(coords, properties, options) {
    return new ymaps.Placemark(coords, properties, options);
}

// ============================================================================
// ИНТЕРФЕЙС
// ============================================================================
function initializeUI() {
    // Навигация
    setupNavigation();
    
    // Кнопка обновления
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadAllData();
        showNotification('Данные обновлены', 'success');
    });
    
    // Кнопка "Найти меня"
    document.getElementById('locateBtn').addEventListener('click', locateUser);
    
    // Легенда
    setupLegend();
    
    // Система проблем
    setupProblemSystem();
}

function setupNavigation() {
    const navItems = {
        navMap: 'map',
        navObjects: 'objects',
        navProblems: 'problems',
        navIdeas: 'ideas',
        navVoting: 'voting'
    };
    
    Object.entries(navItems).forEach(([navId, screen]) => {
        const element = document.getElementById(navId);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                switchScreen(screen);
                
                // Обновляем активный пункт меню
                document.querySelectorAll('.nav__link').forEach(link => {
                    link.classList.remove('active');
                });
                element.classList.add('active');
            });
        }
    });
}

function switchScreen(screenName) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(`screen${screenName.charAt(0).toUpperCase() + screenName.slice(1)}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenName;
    }
}

// ============================================================================
// СИСТЕМА ПРОБЛЕМ
// ============================================================================
function setupProblemSystem() {
    const reportBtn = document.getElementById('reportProblemBtn');
    const addProblemBtn = document.getElementById('addProblemBtn');
    const problemModal = document.getElementById('problemModal');
    
    if (reportBtn) {
        reportBtn.addEventListener('click', () => openProblemModal());
    }
    
    if (addProblemBtn) {
        addProblemBtn.addEventListener('click', () => openProblemModal());
    }
    
    // Закрытие модального окна
    document.getElementById('cancelProblem')?.addEventListener('click', () => {
        problemModal.style.display = 'none';
    });
    
    // Выбор местоположения
    document.getElementById('selectProblemLocation')?.addEventListener('click', () => {
        selectProblemLocation();
    });
    
    // Отправка проблемы
    document.getElementById('submitProblem')?.addEventListener('click', () => {
        submitProblem();
    });
}

function openProblemModal() {
    if (!authSystem.checkPermission('add_problem')) {
        authSystem.showNotification('Для сообщения о проблеме выберите роль "Народный мониторинг" или выше', 'error');
        return;
    }
    
    document.getElementById('problemModal').style.display = 'flex';
    resetProblemForm();
}

function resetProblemForm() {
    document.getElementById('problemTitle').value = '';
    document.getElementById('problemDescription').value = '';
    document.getElementById('problemPhoto').value = '';
}

function selectProblemLocation() {
    // В реальном приложении здесь будет выбор на карте
    const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
    
    document.getElementById('problemLat').textContent = lat;
    document.getElementById('problemLon').textContent = lon;
    
    showNotification('Координаты установлены', 'success');
}

async function submitProblem() {
    const title = document.getElementById('problemTitle').value.trim();
    const type = document.getElementById('problemType').value;
    const description = document.getElementById('problemDescription').value.trim();
    const lat = parseFloat(document.getElementById('problemLat').textContent);
    const lon = parseFloat(document.getElementById('problemLon').textContent);
    
    if (!title || !description) {
        showNotification('Заполните название и описание проблемы', 'error');
        return;
    }
    
    const problem = {
        id: Date.now(),
        title: title,
        type: type,
        description: description,
        status: 'new',
        location: [lat, lon],
        author: authSystem.getUserInfo().roleName,
        date: new Date().toISOString().split('T')[0],
        votes: 0,
        comments: 0
    };
    
    // В реальном приложении здесь будет отправка на сервер
    currentProblems.unshift(problem);
    addProblemToMap(problem);
    
    document.getElementById('problemModal').style.display = 'none';
    showNotification('Проблема успешно отправлена!', 'success');
    
    // Сохраняем в localStorage для демо
    saveProblemsToLocal();
    updateStatistics();
}

function saveProblemsToLocal() {
    localStorage.setItem('eco_problems_data', JSON.stringify(currentProblems));
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================
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
        }
    ];
}

function getDefaultProblems() {
    return [
        {
            id: 1,
            title: 'Засохло дерево у школы',
            type: 'tree',
            description: 'Дерево полностью засохло, требуется спил',
            status: 'new',
            location: [52.5170, 85.2090],
            author: 'Житель',
            date: '2024-01-15',
            votes: 5,
            comments: 2
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

function getProblemColor(status) {
    switch(status) {
        case 'new': return '#FF9800';
        case 'inwork': return '#2196F3';
        case 'solved': return '#4CAF50';
        default: return '#757575';
    }
}

function createObjectBalloon(obj) {
    return `
        <div class="balloon-content">
            <div class="balloon-header">
                <h4>${obj.name}</h4>
                <span class="object-type">${getTypeName(obj.type)}</span>
            </div>
            <div class="balloon-body">
                ${obj.description ? `<p>${obj.description}</p>` : ''}
                <p><i class="fas fa-map-marker-alt"></i> ${obj.coords[0].toFixed(6)}, ${obj.coords[1].toFixed(6)}</p>
            </div>
        </div>
    `;
}

function createProblemBalloon(problem) {
    return `
        <div class="balloon-content">
            <div class="balloon-header">
                <h4>${problem.title}</h4>
                <span class="problem-status">${getProblemStatusName(problem.status)}</span>
            </div>
            <div class="balloon-body">
                <p>${problem.description}</p>
                <p><i class="far fa-user"></i> ${problem.author}</p>
                <p><i class="far fa-calendar"></i> ${problem.date}</p>
            </div>
        </div>
    `;
}

function getTypeName(type) {
    const types = {
        tree: 'Дерево',
        lawn: 'Газон',
        bush: 'Кустарник'
    };
    return types[type] || 'Объект';
}

function getProblemStatusName(status) {
    const statuses = {
        new: 'Новая',
        inwork: 'В работе',
        solved: 'Решено'
    };
    return statuses[status] || status;
}

function updateStatistics() {
    // Статистика объектов
    const treeCount = currentObjects.filter(o => o.type === 'tree').length;
    const lawnCount = currentObjects.filter(o => o.type === 'lawn').length;
    const bushCount = currentObjects.filter(o => o.type === 'bush').length;
    
    document.getElementById('treeCount')?.textContent = treeCount;
    document.getElementById('lawnCount')?.textContent = lawnCount;
    document.getElementById('bushCount')?.textContent = bushCount;
    
    // Статистика проблем
    const problemNew = currentProblems.filter(p => p.status === 'new').length;
    const problemWork = currentProblems.filter(p => p.status === 'inwork').length;
    const problemSolved = currentProblems.filter(p => p.status === 'solved').length;
    
    document.getElementById('problemNewCount')?.textContent = problemNew;
    document.getElementById('problemWorkCount')?.textContent = problemWork;
    document.getElementById('problemSolvedCount')?.textContent = problemSolved;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const location = [position.coords.latitude, position.coords.longitude];
                myMap.setCenter(location, 15);
                showNotification('Ваше местоположение определено');
            },
            error => {
                showNotification('Не удалось определить местоположение', 'error');
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
    
    const colors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3'
    };
    
    notification.style.background = colors[type] || colors.success;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function setupLegend() {
    const toggle = document.getElementById('legendToggle');
    const body = document.getElementById('legendBody');
    
    if (toggle && body) {
        toggle.addEventListener('click', () => {
            const isVisible = body.style.display !== 'none';
            body.style.display = isVisible ? 'none' : 'block';
            const icon = toggle.querySelector('i');
            icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        });
    }
}

// ============================================================================
// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
// ============================================================================
window.showNotification = showNotification;
