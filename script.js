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
        votes: 'data/votes.json',
        suggestions: 'data/suggestions.json',
        categories: 'data/categories.json'
    }
};

// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================================
let myMap;
let currentObjects = [];
let currentProblems = [];
let currentSuggestions = [];
let currentScreen = 'map';
let selectedObjectForProblem = null;

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
        loadProblems(),
        loadSuggestions()
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

async function loadSuggestions() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.suggestions);
        const response = await fetch(url);
        
        if (response.ok) {
            currentSuggestions = await response.json();
            renderSuggestionsOnMap();
        }
    } catch (error) {
        console.error('Ошибка загрузки предложений:', error);
        currentSuggestions = [];
    }
}

function buildDataUrl(filePath) {
    return `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/main/${filePath}?t=${Date.now()}`;
}

// ============================================================================
// РАБОТА С КАРТОЙ
// ============================================================================
function renderObjectsOnMap() {
    // Очищаем только объекты
    const objectPlacemarks = myMap.geoObjects.filter(geoObject => 
        geoObject.properties && geoObject.properties.get('objectType') === 'object'
    );
    myMap.geoObjects.remove(objectPlacemarks);
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        addObjectToMap(obj);
    });
}

function renderProblemsOnMap() {
    // Очищаем только проблемы
    const problemPlacemarks = myMap.geoObjects.filter(geoObject => 
        geoObject.properties && geoObject.properties.get('objectType') === 'problem'
    );
    myMap.geoObjects.remove(problemPlacemarks);
    
    // Добавляем проблемы
    currentProblems.forEach(problem => {
        addProblemToMap(problem);
    });
}

function renderSuggestionsOnMap() {
    // Очищаем только предложения
    const suggestionPlacemarks = myMap.geoObjects.filter(geoObject => 
        geoObject.properties && geoObject.properties.get('objectType') === 'suggestion'
    );
    myMap.geoObjects.remove(suggestionPlacemarks);
    
    // Добавляем предложения
    currentSuggestions.forEach(suggestion => {
        addSuggestionToMap(suggestion);
    });
}

function addObjectToMap(obj) {
    const placemark = createPlacemark(obj.coords || obj.location, {
        balloonContent: createObjectBalloon(obj),
        hintContent: obj.name || `Объект #${obj.id}`,
        objectType: 'object',
        objectId: obj.id,
        objectData: obj
    }, {
        preset: 'islands#circleIcon',
        iconColor: getColorByType(obj.type),
        iconGlyph: getIconByType(obj.type)
    });
    
    // Добавляем обработчик клика для сообщения о проблеме
    placemark.events.add('click', function(e) {
        const objectData = e.get('target').properties.get('objectData');
        openProblemModalForObject(objectData);
    });
    
    myMap.geoObjects.add(placemark);
}

function addProblemToMap(problem) {
    const placemark = createPlacemark(problem.location, {
        balloonContent: createProblemBalloon(problem),
        hintContent: problem.title,
        objectType: 'problem',
        problemId: problem.id,
        problemData: problem
    }, {
        preset: 'islands#circleIcon',
        iconColor: getProblemColor(problem.status),
        iconGlyph: 'exclamation'
    });
    
    myMap.geoObjects.add(placemark);
}

function addSuggestionToMap(suggestion) {
    const placemark = createPlacemark(suggestion.location, {
        balloonContent: createSuggestionBalloon(suggestion),
        hintContent: suggestion.title,
        objectType: 'suggestion',
        suggestionId: suggestion.id,
        suggestionData: suggestion
    }, {
        preset: 'islands#circleIcon',
        iconColor: '#9C27B0',
        iconGlyph: 'marker'
    });
    
    myMap.geoObjects.add(placemark);
}

// Экспортируем функцию для использования в других файлах
window.addSuggestionToMap = addSuggestionToMap;

function addIdeaToMap(idea) {
    const placemark = createPlacemark(idea.location, {
        balloonContent: createIdeaBalloon(idea),
        hintContent: idea.title,
        objectType: 'idea',
        ideaId: idea.id,
        ideaData: idea
    }, {
        preset: 'islands#circleIcon',
        iconColor: '#FFC107',
        iconGlyph: 'lightbulb'
    });
    
    myMap.geoObjects.add(placemark);
}

// Экспортируем функцию для использования в других файлах
window.addIdeaToMap = addIdeaToMap;

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
    
    // Система объектов
    setupObjectSystem();
    
    // Система проблем
    setupProblemSystem();
    
    // Система предложений
    setupSuggestionSystem();
    
    // Система создания голосований
    setupVotingCreationSystem();
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
        
        // Загружаем данные для экрана, если нужно
        if (screenName === 'objects') {
            renderObjectsList();
        } else if (screenName === 'problems') {
            renderProblemsList();
        }
    }
}

// Экспортируем для использования в других файлах
window.switchScreen = switchScreen;

// ============================================================================
// СИСТЕМА ОБЪЕКТОВ
// ============================================================================
function setupObjectSystem() {
    const addObjectBtn = document.getElementById('addObjectBtn');
    const addObjectFromListBtn = document.getElementById('addObjectFromListBtn');
    const objectModal = document.getElementById('objectModal');
    
    if (addObjectBtn) {
        addObjectBtn.addEventListener('click', () => openObjectModal());
    }
    
    if (addObjectFromListBtn) {
        addObjectFromListBtn.addEventListener('click', () => openObjectModal());
    }
    
    // Закрытие модального окна
    document.getElementById('cancelObject')?.addEventListener('click', () => {
        objectModal.style.display = 'none';
    });
    
    // Выбор местоположения
    document.getElementById('selectObjectLocation')?.addEventListener('click', () => {
        selectObjectLocation();
    });
    
    // Отправка объекта
    document.getElementById('submitObject')?.addEventListener('click', () => {
        submitObject();
    });
    
    // Фильтры объектов
    document.querySelectorAll('.objects-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            
            // Обновляем активную кнопку
            document.querySelectorAll('.objects-filters .filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            e.currentTarget.classList.add('active');
            
            renderObjectsList(filter);
        });
    });
}

function openObjectModal() {
    if (!authSystem.checkPermission('add_object')) {
        authSystem.showNotification('Только специалисты и администраторы могут добавлять объекты', 'error');
        return;
    }
    
    document.getElementById('objectModal').style.display = 'flex';
    resetObjectForm();
}

function resetObjectForm() {
    document.getElementById('objectName').value = '';
    document.getElementById('objectDescription').value = '';
    document.getElementById('objectSpecies').value = '';
    document.getElementById('objectAge').value = '';
    document.getElementById('objectCondition').value = 'good';
    document.getElementById('objectLat').textContent = '52.518600';
    document.getElementById('objectLon').textContent = '85.207600';
}

function selectObjectLocation() {
    // В реальном приложении здесь будет выбор на карте
    const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
    
    document.getElementById('objectLat').textContent = lat;
    document.getElementById('objectLon').textContent = lon;
    
    showNotification('Координаты установлены', 'success');
}

async function submitObject() {
    const type = document.getElementById('objectType').value;
    const name = document.getElementById('objectName').value.trim();
    const description = document.getElementById('objectDescription').value.trim();
    const species = document.getElementById('objectSpecies').value.trim();
    const age = document.getElementById('objectAge').value.trim();
    const condition = document.getElementById('objectCondition').value;
    const lat = parseFloat(document.getElementById('objectLat').textContent);
    const lon = parseFloat(document.getElementById('objectLon').textContent);
    
    if (!name) {
        showNotification('Заполните название объекта', 'error');
        return;
    }
    
    const userInfo = authSystem.getUserInfo();
    
    const object = {
        id: Date.now(),
        type: type,
        name: name,
        description: description,
        species: species,
        age: age,
        condition: condition,
        coords: [lat, lon],
        location: [lat, lon],
        createdBy: userInfo.role,
        createdByName: userInfo.roleName,
        createdById: userInfo.id,
        createdDate: new Date().toISOString().split('T')[0],
        status: 'active',
        problems: [],
        photos: []
    };
    
    // В реальном приложении здесь будет отправка на сервер/GitHub
    currentObjects.unshift(object);
    addObjectToMap(object);
    
    document.getElementById('objectModal').style.display = 'none';
    showNotification('Объект успешно добавлен!', 'success');
    
    // Сохраняем в localStorage для демо
    saveObjectsToLocal();
    updateStatistics();
    
    // Обновляем список объектов на экране
    if (currentScreen === 'objects') {
        renderObjectsList();
    }
}

function saveObjectsToLocal() {
    localStorage.setItem('eco_objects_data', JSON.stringify(currentObjects));
}

function renderObjectsList(filter = 'all') {
    const container = document.getElementById('objectsList');
    if (!container) return;
    
    let filteredObjects = currentObjects;
    
    if (filter !== 'all') {
        filteredObjects = currentObjects.filter(obj => obj.type === filter);
    }
    
    if (filteredObjects.length === 0) {
        container.innerHTML = '<div class="empty-state">Объектов пока нет</div>';
        return;
    }
    
    container.innerHTML = filteredObjects.map(obj => createObjectCard(obj)).join('');
    
    // Добавляем обработчики событий для карточек
    addObjectCardEventListeners();
}

function createObjectCard(obj) {
    const typeNames = {
        tree: 'Дерево',
        lawn: 'Газон',
        bush: 'Кустарник',
        flowerbed: 'Клумба',
        bench: 'Скамейка',
        fountain: 'Фонтан'
    };
    
    const conditionNames = {
        good: { text: 'Хорошее', class: 'status-solved' },
        normal: { text: 'Нормальное', class: 'status-inwork' },
        bad: { text: 'Плохое', class: 'status-new' },
        critical: { text: 'Критическое', class: 'status-critical' }
    };
    
    const condition = conditionNames[obj.condition] || conditionNames.normal;
    
    return `
        <div class="object-card" data-id="${obj.id}">
            <div class="object-header">
                <div class="object-title">${obj.name || `Объект #${obj.id}`}</div>
                <div class="object-type ${obj.type}">${typeNames[obj.type] || obj.type}</div>
            </div>
            
            <div class="object-meta">
                <span><i class="far fa-user"></i> ${obj.createdByName || 'Неизвестно'}</span>
                <span><i class="far fa-calendar"></i> ${obj.createdDate}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${obj.coords[0].toFixed(4)}, ${obj.coords[1].toFixed(4)}</span>
            </div>
            
            ${obj.description ? `<p class="object-description">${obj.description}</p>` : ''}
            
            ${obj.species ? `
                <div class="object-info">
                    <strong>Вид:</strong> ${obj.species}
                </div>
            ` : ''}
            
            ${obj.age ? `
                <div class="object-info">
                    <strong>Возраст/Размер:</strong> ${obj.age}
                </div>
            ` : ''}
            
            <div class="object-status">
                <span class="status-badge ${condition.class}">${condition.text}</span>
            </div>
            
            <div class="object-actions">
                <button class="btn btn--small btn-report-problem" data-id="${obj.id}">
                    <i class="fas fa-exclamation-triangle"></i> Сообщить о проблеме
                </button>
                
                ${authSystem.checkPermission('delete_object') ? `
                    <button class="btn btn--small btn-delete-object" data-id="${obj.id}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function addObjectCardEventListeners() {
    // Кнопка "Сообщить о проблеме"
    document.querySelectorAll('.btn-report-problem').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const objectId = parseInt(e.currentTarget.dataset.id);
            const object = currentObjects.find(obj => obj.id === objectId);
            if (object) {
                openProblemModalForObject(object);
            }
        });
    });
    
    // Кнопка "Удалить" (только для админов)
    if (authSystem.checkPermission('delete_object')) {
        document.querySelectorAll('.btn-delete-object').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const objectId = parseInt(e.currentTarget.dataset.id);
                if (confirm('Вы уверены, что хотите удалить этот объект?')) {
                    deleteObject(objectId);
                }
            });
        });
    }
}

function deleteObject(objectId) {
    currentObjects = currentObjects.filter(obj => obj.id !== objectId);
    
    // Удаляем с карты
    const placemark = myMap.geoObjects.find(geoObject => 
        geoObject.properties && 
        geoObject.properties.get('objectType') === 'object' &&
        geoObject.properties.get('objectId') === objectId
    );
    
    if (placemark) {
        myMap.geoObjects.remove(placemark);
    }
    
    // Сохраняем
    saveObjectsToLocal();
    updateStatistics();
    
    // Обновляем список
    if (currentScreen === 'objects') {
        renderObjectsList();
    }
    
    showNotification('Объект удален', 'success');
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
        selectedObjectForProblem = null;
    });
    
    // Выбор местоположения
    document.getElementById('selectProblemLocation')?.addEventListener('click', () => {
        selectProblemLocation();
    });
    
    // Отправка проблемы
    document.getElementById('submitProblem')?.addEventListener('click', () => {
        submitProblem();
    });
    
    // Фильтры проблем
    document.querySelectorAll('.problems-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            
            // Обновляем активную кнопку
            document.querySelectorAll('.problems-filters .filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            e.currentTarget.classList.add('active');
            
            renderProblemsList(filter);
        });
    });
    
    // Обновляем лимиты проблем
    updateProblemLimits();
}

function openProblemModal() {
    if (!authSystem.checkPermission('add_problem')) {
        authSystem.showNotification('Для сообщения о проблеме выберите роль "Житель" или выше', 'error');
        return;
    }
    
    if (!authSystem.canSubmitProblem()) {
        authSystem.showNotification('Вы исчерпали лимит сообщений о проблемах на сегодня', 'error');
        return;
    }
    
    document.getElementById('problemModal').style.display = 'flex';
    resetProblemForm();
    
    // Заполняем список объектов для привязки
    fillObjectsSelect();
}

function openProblemModalForObject(object) {
    if (!authSystem.checkPermission('add_problem')) {
        authSystem.showNotification('Для сообщения о проблеме выберите роль "Житель" или выше', 'error');
        return;
    }
    
    if (!authSystem.canSubmitProblem()) {
        authSystem.showNotification('Вы исчерпали лимит сообщений о проблемах на сегодня', 'error');
        return;
    }
    
    selectedObjectForProblem = object;
    document.getElementById('problemModal').style.display = 'flex';
    resetProblemForm();
    
    // Заполняем список объектов для привязки
    fillObjectsSelect();
    
    // Устанавливаем выбранный объект и координаты
    if (object) {
        document.getElementById('problemObject').value = object.id;
        document.getElementById('problemLat').textContent = object.coords[0];
        document.getElementById('problemLon').textContent = object.coords[1];
        
        // Устанавливаем тип проблемы в зависимости от типа объекта
        if (object.type === 'tree') {
            document.getElementById('problemType').value = 'tree_problem';
        } else if (object.type === 'lawn') {
            document.getElementById('problemType').value = 'lawn_problem';
        } else if (object.type === 'bush') {
            document.getElementById('problemType').value = 'bush_problem';
        }
    }
}

function resetProblemForm() {
    document.getElementById('problemTitle').value = '';
    document.getElementById('problemDescription').value = '';
    document.getElementById('problemPhoto').value = '';
    document.getElementById('problemSeverity').value = 'medium';
    document.getElementById('problemLat').textContent = '52.518600';
    document.getElementById('problemLon').textContent = '85.207600';
    
    // Сбрасываем выбранный объект, если он не был передан явно
    if (!selectedObjectForProblem) {
        document.getElementById('problemObject').value = '';
    }
}

function fillObjectsSelect() {
    const select = document.getElementById('problemObject');
    if (!select) return;
    
    // Очищаем все опции, кроме первой
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Добавляем объекты
    currentObjects.forEach(obj => {
        const option = document.createElement('option');
        option.value = obj.id;
        option.textContent = obj.name || `Объект #${obj.id} (${getTypeName(obj.type)})`;
        select.appendChild(option);
    });
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
    const objectId = document.getElementById('problemObject').value;
    const severity = document.getElementById('problemSeverity').value;
    const lat = parseFloat(document.getElementById('problemLat').textContent);
    const lon = parseFloat(document.getElementById('problemLon').textContent);
    
    if (!title || !description) {
        showNotification('Заполните название и описание проблемы', 'error');
        return;
    }
    
    if (!authSystem.canSubmitProblem()) {
        showNotification('Лимит сообщений о проблемах исчерпан', 'error');
        return;
    }
    
    const userInfo = authSystem.getUserInfo();
    const selectedObject = objectId ? currentObjects.find(obj => obj.id == objectId) : null;
    
    const problem = {
        id: Date.now(),
        title: title,
        type: type,
        description: description,
        severity: severity,
        status: 'new',
        location: [lat, lon],
        objectId: objectId || null,
        objectName: selectedObject ? selectedObject.name : null,
        objectType: selectedObject ? selectedObject.type : null,
        author: userInfo.roleName,
        authorRole: userInfo.role,
        authorId: userInfo.id,
        date: new Date().toISOString().split('T')[0],
        votes: 0,
        comments: [],
        photos: []
    };
    
    // В реальном приложении здесь будет отправка на сервер
    currentProblems.unshift(problem);
    addProblemToMap(problem);
    
    // Регистрируем отправку проблемы
    authSystem.registerProblemSubmission(problem.id);
    
    document.getElementById('problemModal').style.display = 'none';
    selectedObjectForProblem = null;
    
    showNotification('Проблема успешно отправлена!', 'success');
    
    // Сохраняем в localStorage для демо
    saveProblemsToLocal();
    updateStatistics();
    updateProblemLimits();
    
    // Обновляем список проблем на экране
    if (currentScreen === 'problems') {
        renderProblemsList();
    }
    
    // Если проблема привязана к объекту, обновляем объект
    if (selectedObject) {
        if (!selectedObject.problems) selectedObject.problems = [];
        selectedObject.problems.push({
            id: problem.id,
            title: problem.title,
            date: problem.date
        });
        saveObjectsToLocal();
    }
}

function saveProblemsToLocal() {
    localStorage.setItem('eco_problems_data', JSON.stringify(currentProblems));
}

function updateProblemLimits() {
    const problemsLeft = document.getElementById('problemsLeft');
    if (problemsLeft) {
        problemsLeft.textContent = authSystem.getRemainingProblems();
    }
    
    const problemLimits = document.getElementById('problemLimits');
    if (problemLimits) {
        problemLimits.style.display = authSystem.checkPermission('add_problem') ? 'block' : 'none';
    }
}

function renderProblemsList(filter = 'all') {
    const container = document.getElementById('problemsList');
    if (!container) return;
    
    let filteredProblems = currentProblems;
    const userId = authSystem.userId;
    
    // Фильтрация
    switch(filter) {
        case 'new':
            filteredProblems = currentProblems.filter(p => p.status === 'new');
            break;
        case 'inwork':
            filteredProblems = currentProblems.filter(p => p.status === 'inwork');
            break;
        case 'solved':
            filteredProblems = currentProblems.filter(p => p.status === 'solved');
            break;
        case 'my':
            filteredProblems = currentProblems.filter(p => p.authorId === userId);
            break;
    }
    
    if (filteredProblems.length === 0) {
        container.innerHTML = '<div class="empty-state">Проблем пока нет</div>';
        return;
    }
    
    container.innerHTML = filteredProblems.map(problem => createProblemCard(problem)).join('');
    
    // Обновляем статистику
    updateProblemsStats();
}

function createProblemCard(problem) {
    const severityLabels = {
        low: { text: 'Низкая', color: '#4CAF50' },
        medium: { text: 'Средняя', color: '#FF9800' },
        high: { text: 'Высокая', color: '#F44336' },
        critical: { text: 'Критическая', color: '#9C27B0' }
    };
    
    const statusLabels = {
        new: { text: 'Новая', class: 'status-new' },
        inwork: { text: 'В работе', class: 'status-inwork' },
        solved: { text: 'Решено', class: 'status-solved' }
    };
    
    const severity = severityLabels[problem.severity] || severityLabels.medium;
    const status = statusLabels[problem.status] || statusLabels.new;
    
    return `
        <div class="problem-card ${problem.status}" data-id="${problem.id}">
            <div class="problem-header">
                <div class="problem-title">${problem.title}</div>
                <div class="problem-status ${status.class}">${status.text}</div>
            </div>
            
            <div class="problem-meta">
                <span><i class="far fa-user"></i> ${problem.author}</span>
                <span><i class="far fa-calendar"></i> ${problem.date}</span>
                <span style="color: ${severity.color};"><i class="fas fa-exclamation-circle"></i> ${severity.text}</span>
            </div>
            
            <p class="problem-description">${problem.description}</p>
            
            ${problem.objectName ? `
                <div class="problem-object">
                    <strong>Объект:</strong> ${problem.objectName}
                </div>
            ` : ''}
            
            <div class="problem-stats">
                <div class="problem-stat">
                    <i class="fas fa-thumbs-up"></i>
                    <span>${problem.votes}</span>
                </div>
                <div class="problem-stat">
                    <i class="far fa-comment"></i>
                    <span>${problem.comments ? problem.comments.length : 0}</span>
                </div>
            </div>
            
            ${authSystem.checkPermission('moderate') ? `
                <div class="moderate-actions">
                    <button class="btn btn--small btn-progress-problem" data-id="${problem.id}">
                        <i class="fas fa-play"></i> В работу
                    </button>
                    <button class="btn btn--small btn-solve-problem" data-id="${problem.id}">
                        <i class="fas fa-check"></i> Решено
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function updateProblemsStats() {
    const total = currentProblems.length;
    const newProblems = currentProblems.filter(p => p.status === 'new').length;
    const inWork = currentProblems.filter(p => p.status === 'inwork').length;
    const solved = currentProblems.filter(p => p.status === 'solved').length;
    
    document.getElementById('problemsTotal')?.textContent = total;
    document.getElementById('problemsNew')?.textContent = newProblems;
    document.getElementById('problemsInWork')?.textContent = inWork;
    document.getElementById('problemsSolved')?.textContent = solved;
}

// ============================================================================
// СИСТЕМА ПРЕДЛОЖЕНИЙ
// ============================================================================
function setupSuggestionSystem() {
    const addSuggestionBtn = document.getElementById('addSuggestionBtn');
    const suggestionModal = document.getElementById('suggestionModal');
    
    if (addSuggestionBtn) {
        addSuggestionBtn.addEventListener('click', () => openSuggestionModal());
    }
    
    // Закрытие модального окна
    document.getElementById('cancelSuggestion')?.addEventListener('click', () => {
        suggestionModal.style.display = 'none';
    });
    
    // Выбор местоположения
    document.getElementById('selectSuggestionLocation')?.addEventListener('click', () => {
        selectSuggestionLocation();
    });
    
    // Отправка предложения
    document.getElementById('submitSuggestion')?.addEventListener('click', () => {
        submitSuggestion();
    });
}

function openSuggestionModal() {
    if (!authSystem.checkPermission('add_suggestion')) {
        authSystem.showNotification('У вас недостаточно прав для добавления предложений', 'error');
        return;
    }
    
    document.getElementById('suggestionModal').style.display = 'flex';
    resetSuggestionForm();
}

function resetSuggestionForm() {
    document.getElementById('suggestionTitle').value = '';
    document.getElementById('suggestionDescription').value = '';
    document.getElementById('suggestionLat').textContent = '52.518600';
    document.getElementById('suggestionLon').textContent = '85.207600';
}

function selectSuggestionLocation() {
    // В реальном приложении здесь будет выбор на карте
    const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
    
    document.getElementById('suggestionLat').textContent = lat;
    document.getElementById('suggestionLon').textContent = lon;
    
    showNotification('Координаты установлены', 'success');
}

async function submitSuggestion() {
    // Эта функция вызывается из ideas.js
    // Здесь можно добавить дополнительную логику, если нужно
    console.log('Предложение отправлено из ideas.js');
}

// ============================================================================
// СИСТЕМА СОЗДАНИЯ ГОЛОСОВАНИЙ
// ============================================================================
function setupVotingCreationSystem() {
    const createVotingBtn = document.getElementById('createVotingBtn');
    const createVotingModal = document.getElementById('createVotingModal');
    
    if (createVotingBtn) {
        createVotingBtn.addEventListener('click', () => openCreateVotingModal());
    }
    
    // Закрытие модального окна
    document.getElementById('cancelCreateVoting')?.addEventListener('click', () => {
        createVotingModal.style.display = 'none';
    });
    
    // Добавление варианта ответа
    document.getElementById('addVotingOption')?.addEventListener('click', () => {
        addVotingOption();
    });
    
    // Отправка голосования
    document.getElementById('submitCreateVoting')?.addEventListener('click', () => {
        submitCreateVoting();
    });
}

function openCreateVotingModal() {
    if (!authSystem.checkPermission('create_voting')) {
        authSystem.showNotification('Только администраторы могут создавать голосования', 'error');
        return;
    }
    
    document.getElementById('createVotingModal').style.display = 'flex';
    resetCreateVotingForm();
    
    // Устанавливаем даты по умолчанию
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    document.getElementById('votingStartDate').value = today.toISOString().split('T')[0];
    document.getElementById('votingEndDate').value = nextWeek.toISOString().split('T')[0];
}

function resetCreateVotingForm() {
    document.getElementById('votingTitle').value = '';
    document.getElementById('votingDescription').value = '';
    document.getElementById('votingType').value = 'idea';
    document.getElementById('votingMinVotes').value = '100';
    document.getElementById('votingIdeaId').value = '';
    
    // Очищаем варианты ответов, оставляя два
    const optionsContainer = document.getElementById('votingOptions');
    optionsContainer.innerHTML = `
        <div class="voting-option-input">
            <input type="text" placeholder="Вариант 1" class="voting-option-text">
            <button type="button" class="btn-remove-option"><i class="fas fa-times"></i></button>
        </div>
        <div class="voting-option-input">
            <input type="text" placeholder="Вариант 2" class="voting-option-text">
            <button type="button" class="btn-remove-option"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Добавляем обработчики для кнопок удаления
    addVotingOptionEventListeners();
}

function addVotingOption() {
    const optionsContainer = document.getElementById('votingOptions');
    const optionCount = optionsContainer.children.length + 1;
    
    const optionDiv = document.createElement('div');
    optionDiv.className = 'voting-option-input
