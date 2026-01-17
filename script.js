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
let myMap = null;
let currentObjects = [];
let currentProblems = [];
let currentSuggestions = [];
let currentScreen = 'map';
let selectedObjectForProblem = null;
let isMapInitialized = false;

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌳 Умный город Бийск - Инициализация...');
    
    // Инициализируем карту после загрузки Яндекс.Карт
    if (typeof ymaps !== 'undefined') {
        initMap();
    } else {
        // Ждем загрузки Яндекс.Карт
        window.addEventListener('yandex-maps-loaded', initMap);
    }
    
    // Инициализация интерфейса
    initializeUI();
});

function initMap() {
    console.log('🗺️ Инициализация карты...');
    
    try {
        ymaps.ready(function() {
            console.log('✅ Яндекс.Карты загружены');
            
            // Создаем карту
            myMap = new ymaps.Map('map', {
                center: [52.5186, 85.2076],
                zoom: 13,
                controls: ['zoomControl', 'fullscreenControl']
            }, {
                searchControlProvider: 'yandex#search'
            });
            
            // Настройка элементов управления
            myMap.controls.get('zoomControl').options.set({
                size: 'large',
                position: { right: 10, top: 150 }
            });
            
            myMap.controls.get('fullscreenControl').options.set({
                position: { right: 10, top: 220 }
            });
            
            // Добавляем поиск
            const searchControl = new ymaps.control.SearchControl({
                options: {
                    provider: 'yandex#search',
                    noPlacemark: true,
                    position: { left: 10, top: 10 }
                }
            });
            myMap.controls.add(searchControl);
            
            isMapInitialized = true;
            console.log('✅ Карта создана');
            
            // Загружаем данные
            loadAllData();
        });
    } catch (error) {
        console.error('❌ Ошибка создания карты:', error);
        showNotification('Ошибка загрузки карты', 'error');
    }
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================
async function loadAllData() {
    console.log('📦 Загрузка данных...');
    
    try {
        await Promise.all([
            loadObjects(),
            loadProblems(),
            loadSuggestions()
        ]);
        
        updateStatistics();
        console.log('✅ Данные загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

async function loadObjects() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.objects);
        console.log('Загрузка объектов:', url);
        
        const response = await fetch(url);
        
        if (response.ok) {
            currentObjects = await response.json();
            console.log(`Загружено объектов: ${currentObjects.length}`);
            
            if (isMapInitialized) {
                renderObjectsOnMap();
            }
        } else {
            console.warn('Не удалось загрузить объекты, используем демо-данные');
            currentObjects = getDefaultObjects();
            
            if (isMapInitialized) {
                renderObjectsOnMap();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки объектов:', error);
        currentObjects = getDefaultObjects();
        
        if (isMapInitialized) {
            renderObjectsOnMap();
        }
    }
}

async function loadProblems() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.problems);
        const response = await fetch(url);
        
        if (response.ok) {
            currentProblems = await response.json();
            console.log(`Загружено проблем: ${currentProblems.length}`);
            
            if (isMapInitialized) {
                renderProblemsOnMap();
            }
        } else {
            currentProblems = getDefaultProblems();
            
            if (isMapInitialized) {
                renderProblemsOnMap();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки проблем:', error);
        currentProblems = getDefaultProblems();
        
        if (isMapInitialized) {
            renderProblemsOnMap();
        }
    }
}

async function loadSuggestions() {
    try {
        const url = buildDataUrl(CONFIG.DATA_FILES.suggestions);
        const response = await fetch(url);
        
        if (response.ok) {
            currentSuggestions = await response.json();
            console.log(`Загружено предложений: ${currentSuggestions.length}`);
            
            if (isMapInitialized) {
                renderSuggestionsOnMap();
            }
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
    if (!myMap || !isMapInitialized) {
        console.warn('Карта не инициализирована, откладываем рендеринг объектов');
        return;
    }
    
    console.log('🎯 Рендеринг объектов на карте...');
    
    try {
        // Очищаем старые объекты
        const objectPlacemarks = myMap.geoObjects.filter(geoObject => 
            geoObject.properties && geoObject.properties.get('objectType') === 'object'
        );
        myMap.geoObjects.remove(objectPlacemarks);
        
        // Добавляем объекты
        currentObjects.forEach(obj => {
            addObjectToMap(obj);
        });
        
        console.log(`✅ На карту добавлено объектов: ${currentObjects.length}`);
    } catch (error) {
        console.error('❌ Ошибка рендеринга объектов:', error);
    }
}

function renderProblemsOnMap() {
    if (!myMap || !isMapInitialized) return;
    
    try {
        // Очищаем старые проблемы
        const problemPlacemarks = myMap.geoObjects.filter(geoObject => 
            geoObject.properties && geoObject.properties.get('objectType') === 'problem'
        );
        myMap.geoObjects.remove(problemPlacemarks);
        
        // Добавляем проблемы
        currentProblems.forEach(problem => {
            addProblemToMap(problem);
        });
    } catch (error) {
        console.error('Ошибка рендеринга проблем:', error);
    }
}

function renderSuggestionsOnMap() {
    if (!myMap || !isMapInitialized) return;
    
    try {
        // Очищаем старые предложения
        const suggestionPlacemarks = myMap.geoObjects.filter(geoObject => 
            geoObject.properties && geoObject.properties.get('objectType') === 'suggestion'
        );
        myMap.geoObjects.remove(suggestionPlacemarks);
        
        // Добавляем предложения
        currentSuggestions.forEach(suggestion => {
            addSuggestionToMap(suggestion);
        });
    } catch (error) {
        console.error('Ошибка рендеринга предложений:', error);
    }
}

function addObjectToMap(obj) {
    if (!myMap || !isMapInitialized) return;
    
    try {
        const placemark = new ymaps.Placemark(obj.coords || obj.location, {
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
        
        // Добавляем обработчик клика
        placemark.events.add('click', function(e) {
            const objectData = e.get('target').properties.get('objectData');
            openProblemModalForObject(objectData);
        });
        
        myMap.geoObjects.add(placemark);
    } catch (error) {
        console.error('Ошибка добавления объекта на карту:', error);
    }
}

function addProblemToMap(problem) {
    if (!myMap || !isMapInitialized) return;
    
    try {
        const placemark = new ymaps.Placemark(problem.location, {
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
    } catch (error) {
        console.error('Ошибка добавления проблемы на карту:', error);
    }
}

function addSuggestionToMap(suggestion) {
    if (!myMap || !isMapInitialized) return;
    
    try {
        const placemark = new ymaps.Placemark(suggestion.location, {
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
    } catch (error) {
        console.error('Ошибка добавления предложения на карту:', error);
    }
}

// Экспортируем функцию для использования в других файлах
window.addSuggestionToMap = addSuggestionToMap;

function addIdeaToMap(idea) {
    if (!myMap || !isMapInitialized) return;
    
    try {
        const placemark = new ymaps.Placemark(idea.location, {
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
    } catch (error) {
        console.error('Ошибка добавления идеи на карту:', error);
    }
}

// Экспортируем функцию для использования в других файлах
window.addIdeaToMap = addIdeaToMap;

// ============================================================================
// ИНТЕРФЕЙС - ФИКС ОСНОВНОЙ ПРОБЛЕМЫ С НАВИГАЦИЕЙ
// ============================================================================
function initializeUI() {
    console.log('🎨 Инициализация интерфейса...');
    
    // Навигация - ДОБАВЛЯЕМ ТАЙМАУТ ДЛЯ УБЕДИТЕЛЬНОСТИ
    setTimeout(() => {
        setupNavigation();
    }, 100);
    
    // Кнопка обновления
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAllData();
            showNotification('Данные обновлены', 'success');
        });
    } else {
        console.warn('Кнопка обновления не найдена');
    }
    
    // Кнопка "Найти меня"
    const locateBtn = document.getElementById('locateBtn');
    if (locateBtn) {
        locateBtn.addEventListener('click', locateUser);
    }
    
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
    
    console.log('✅ Интерфейс инициализирован');
    // Кнопка добавления идеи
const addIdeaBtn = document.getElementById('addIdeaBtn');
if (addIdeaBtn) {
  addIdeaBtn.addEventListener('click', () => openSidebar('idea'));
}

// Кнопка добавления предложения
const addSuggestionBtn = document.getElementById('addSuggestionBtn');
if (addSuggestionBtn) {
  addSuggestionBtn.addEventListener('click', () => openSidebar('suggestion'));
}

// Кнопка создания голосования (в шапке)
const createVotingBtn = document.getElementById('createVotingBtn');
if (createVotingBtn) {
  createVotingBtn.addEventListener('click', () => openSidebar('voting'));
}

// Закрытие сайдбара при клике вне его
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && !sidebar.contains(e.target) && 
      !e.target.closest('.add-idea-btn') && 
      !e.target.closest('.add-suggestion-btn') && 
      !e.target.closest('.create-voting-btn')) {
    closeSidebar();
  }
});
}

function setupNavigation() {
    console.log('🔧 Настройка навигации...');
    
    const navItems = {
        navMap: 'map',
        navObjects: 'objects',
        navProblems: 'problems',
        navIdeas: 'ideas',
        navVoting: 'voting'
    };
    
    // УБЕДИТЕСЬ ЧТО ЭЛЕМЕНТЫ СУЩЕСТВУЮТ
    setTimeout(() => {
        Object.entries(navItems).forEach(([navId, screen]) => {
            const element = document.getElementById(navId);
            if (element) {
                console.log(`Найден элемент навигации: ${navId}`);
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`Клик по ${navId}, переключение на экран: ${screen}`);
                    switchScreen(screen);
                    
                    // Обновляем активный пункт меню
                    document.querySelectorAll('.nav__link').forEach(link => {
                        link.classList.remove('active');
                    });
                    element.classList.add('active');
                });
            } else {
                console.warn(`Элемент навигации не найден: ${navId}`);
            }
        });
    }, 200);
}

function switchScreen(screenName) {
    console.log(`🔄 Переключение на экран: ${screenName}`);
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(`screen${screenName.charAt(0).toUpperCase() + screenName.slice(1)}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenName;
        console.log(`✅ Экран ${screenName} активирован`);
        
        // Загружаем данные для экрана, если нужно
        if (screenName === 'objects') {
            renderObjectsList();
        } else if (screenName === 'problems') {
            renderProblemsList();
        }
    } else {
        console.error(`❌ Экран не найден: ${screenName}`);
    }
}

// Экспортируем для использования в других файлах
window.switchScreen = switchScreen;

// ============================================================================
// СИСТЕМА ОБЪЕКТОВ - УПРОЩЕННАЯ ВЕРСИЯ ДЛЯ ТЕСТА
// ============================================================================
function setupObjectSystem() {
    console.log('🔧 Настройка системы объектов...');
    
    // Кнопка добавления объекта на карте
    const addObjectBtn = document.getElementById('addObjectBtn');
    if (addObjectBtn) {
        addObjectBtn.addEventListener('click', () => {
            console.log('Клик по кнопке добавления объекта');
            openObjectModal();
        });
    }
    
    // Кнопка добавления объекта из списка
    const addObjectFromListBtn = document.getElementById('addObjectFromListBtn');
    if (addObjectFromListBtn) {
        addObjectFromListBtn.addEventListener('click', () => {
            openObjectModal();
        });
    }
    
    // Модальное окно объекта
    const cancelObjectBtn = document.getElementById('cancelObject');
    const submitObjectBtn = document.getElementById('submitObject');
    const selectObjectLocationBtn = document.getElementById('selectObjectLocation');
    
    if (cancelObjectBtn) {
        cancelObjectBtn.addEventListener('click', () => {
            document.getElementById('objectModal').style.display = 'none';
        });
    }
    
    if (selectObjectLocationBtn) {
        selectObjectLocationBtn.addEventListener('click', selectObjectLocation);
    }
    
    if (submitObjectBtn) {
        submitObjectBtn.addEventListener('click', submitObject);
    }
}

function openObjectModal() {
    console.log('Открытие модального окна объекта');
    
    if (!authSystem || !authSystem.checkPermission('add_object')) {
        showNotification('Только специалисты и администраторы могут добавлять объекты', 'error');
        return;
    }
    
    const modal = document.getElementById('objectModal');
    if (modal) {
        modal.style.display = 'flex';
        resetObjectForm();
    }
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

function submitObject() {
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
    
    // Добавляем объект
    currentObjects.unshift(object);
    addObjectToMap(object);
    
    document.getElementById('objectModal').style.display = 'none';
    showNotification('Объект успешно добавлен!', 'success');
    
    // Сохраняем
    saveObjectsToLocal();
    updateStatistics();
}

function saveObjectsToLocal() {
    localStorage.setItem('eco_objects_data', JSON.stringify(currentObjects));
}

// ============================================================================
// СИСТЕМА ПРОБЛЕМ - УПРОЩЕННАЯ ВЕРСИЯ
// ============================================================================
function setupProblemSystem() {
    console.log('🔧 Настройка системы проблем...');
    
    // Кнопка сообщения о проблеме
    const reportBtn = document.getElementById('reportProblemBtn');
    const addProblemBtn = document.getElementById('addProblemBtn');
    
    if (reportBtn) {
        reportBtn.addEventListener('click', () => openProblemModal());
    }
    
    if (addProblemBtn) {
        addProblemBtn.addEventListener('click', () => openProblemModal());
    }
    
    // Модальное окно проблемы
    const cancelProblemBtn = document.getElementById('cancelProblem');
    const submitProblemBtn = document.getElementById('submitProblem');
    const selectProblemLocationBtn = document.getElementById('selectProblemLocation');
    
    if (cancelProblemBtn) {
        cancelProblemBtn.addEventListener('click', () => {
            document.getElementById('problemModal').style.display = 'none';
            selectedObjectForProblem = null;
        });
    }
    
    if (selectProblemLocationBtn) {
        selectProblemLocationBtn.addEventListener('click', selectProblemLocation);
    }
    
    if (submitProblemBtn) {
        submitProblemBtn.addEventListener('click', submitProblem);
    }
}

function openProblemModal() {
    if (!authSystem || !authSystem.checkPermission('add_problem')) {
        showNotification('Для сообщения о проблеме выберите роль "Житель" или выше', 'error');
        return;
    }
    
    document.getElementById('problemModal').style.display = 'flex';
    resetProblemForm();
}

function resetProblemForm() {
    document.getElementById('problemTitle').value = '';
    document.getElementById('problemDescription').value = '';
    document.getElementById('problemPhoto').value = '';
    document.getElementById('problemSeverity').value = 'medium';
    document.getElementById('problemLat').textContent = '52.518600';
    document.getElementById('problemLon').textContent = '85.207600';
}

function selectProblemLocation() {
    const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
    const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
    
    document.getElementById('problemLat').textContent = lat;
    document.getElementById('problemLon').textContent = lon;
    
    showNotification('Координаты установлены', 'success');
}

function submitProblem() {
    const title = document.getElementById('problemTitle').value.trim();
    const type = document.getElementById('problemType').value;
    const description = document.getElementById('problemDescription').value.trim();
    const severity = document.getElementById('problemSeverity').value;
    const lat = parseFloat(document.getElementById('problemLat').textContent);
    const lon = parseFloat(document.getElementById('problemLon').textContent);
    
    if (!title || !description) {
        showNotification('Заполните название и описание проблемы', 'error');
        return;
    }
    
    const userInfo = authSystem.getUserInfo();
    
    const problem = {
        id: Date.now(),
        title: title,
        type: type,
        description: description,
        severity: severity,
        status: 'new',
        location: [lat, lon],
        author: userInfo.roleName,
        authorRole: userInfo.role,
        authorId: userInfo.id,
        date: new Date().toISOString().split('T')[0],
        votes: 0,
        comments: [],
        photos: []
    };
    
    // Добавляем проблему
    currentProblems.unshift(problem);
    addProblemToMap(problem);
    
    document.getElementById('problemModal').style.display = 'none';
    showNotification('Проблема успешно отправлена!', 'success');
    
    // Сохраняем
    saveProblemsToLocal();
    updateStatistics();
}

// ============================================================================
// ОСТАЛЬНЫЕ ФУНКЦИИ (оставляем как есть, но с проверками)
// ============================================================================
function getDefaultObjects() {
    return [
        {
            id: 1,
            type: 'tree',
            name: 'Старый дуб',
            species: 'Дуб обыкновенный',
            age: '50 лет',
            condition: 'good',
            coords: [52.5180, 85.2100],
            description: 'Крупный дуб возрастом около 50 лет',
            createdBy: 'monitor',
            createdByName: 'Специалист',
            createdDate: '2024-03-15',
            status: 'active',
            problems: []
        },
        {
            id: 2,
            type: 'lawn',
            name: 'Газон у школы',
            species: '',
            age: '120 кв.м.',
            condition: 'normal',
            coords: [52.5190, 85.2080],
            description: 'Газон у школы №5',
            createdBy: 'monitor',
            createdByName: 'Специалист',
            createdDate: '2024-03-10',
            status: 'active',
            problems: []
        }
    ];
}

function getDefaultProblems() {
    return [
        {
            id: 1,
            title: 'Засохло дерево у школы',
            type: 'tree_problem',
            description: 'Дерево полностью засохло, требуется спил',
            severity: 'high',
            status: 'new',
            location: [52.5170, 85.2090],
            author: 'Житель',
            authorRole: 'resident',
            date: '2024-01-15',
            votes: 5,
            comments: []
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

function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const location = [position.coords.latitude, position.coords.longitude];
                if (myMap) {
                    myMap.setCenter(location, 15);
                    showNotification('Ваше местоположение определено');
                }
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
    if (!notification) {
        console.log('Уведомление:', message, type);
        return;
    }
    
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

function updateStatistics() {
    // Статистика объектов
    const treeCount = currentObjects.filter(o => o.type === 'tree').length;
    const lawnCount = currentObjects.filter(o => o.type === 'lawn').length;
    const bushCount = currentObjects.filter(o => o.type === 'bush').length;
    const totalObjects = currentObjects.length;
    
    // Обновляем счетчики в легенде
    const treeCountElement = document.getElementById('treeCount');
    const lawnCountElement = document.getElementById('lawnCount');
    const bushCountElement = document.getElementById('bushCount');
    
    if (treeCountElement) treeCountElement.textContent = treeCount;
    if (lawnCountElement) lawnCountElement.textContent = lawnCount;
    if (bushCountElement) bushCountElement.textContent = bushCount;
    
    // Обновляем статистику на экране объектов
    const statsTreeCount = document.getElementById('statsTreeCount');
    const statsLawnCount = document.getElementById('statsLawnCount');
    const statsBushCount = document.getElementById('statsBushCount');
    const statsTotalObjects = document.getElementById('statsTotalObjects');
    
    if (statsTreeCount) statsTreeCount.textContent = treeCount;
    if (statsLawnCount) statsLawnCount.textContent = lawnCount;
    if (statsBushCount) statsBushCount.textContent = bushCount;
    if (statsTotalObjects) statsTotalObjects.textContent = totalObjects;
    
    // Статистика проблем
    const problemNew = currentProblems.filter(p => p.status === 'new').length;
    const problemWork = currentProblems.filter(p => p.status === 'inwork').length;
    const problemSolved = currentProblems.filter(p => p.status === 'solved').length;
    
    const problemNewCount = document.getElementById('problemNewCount');
    const problemWorkCount = document.getElementById('problemWorkCount');
    const problemSolvedCount = document.getElementById('problemSolvedCount');
    
    if (problemNewCount) problemNewCount.textContent = problemNew;
    if (problemWorkCount) problemWorkCount.textContent = problemWork;
    if (problemSolvedCount) problemSolvedCount.textContent = problemSolved;
}
// Добавим в конец script.js перед глобальными экспортами:

function openSidebar(type) {
  const sidebar = document.getElementById('sidebar');
  const sidebarTitle = document.getElementById('sidebarTitle');
  const sidebarContent = document.getElementById('sidebarContent');
  
  if (!sidebar || !sidebarTitle || !sidebarContent) return;
  
  let title = '';
  let content = '';
  
  switch(type) {
    case 'idea':
      title = '<i class="fas fa-lightbulb"></i> Предложить идею';
      content = getIdeaFormContent();
      break;
    case 'suggestion':
      title = '<i class="fas fa-map-marker-alt"></i> Добавить предложение';
      content = getSuggestionFormContent();
      break;
    case 'voting':
      if (!authSystem.checkPermission('create_voting')) {
        showNotification('Только администраторы могут создавать голосования', 'error');
        return;
      }
      title = '<i class="fas fa-vote-yea"></i> Создать голосование';
      content = getVotingFormContent();
      break;
    default:
      return;
  }
  
  sidebarTitle.innerHTML = title;
  sidebarContent.innerHTML = content;
  sidebar.classList.add('open');
  
  // Инициализируем обработчики для формы
  initSidebarForm(type);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('open');
  }
}

function getIdeaFormContent() {
  return `
    <div class="form-group">
      <label for="ideaTitle">Название идеи:</label>
      <input type="text" id="ideaTitle" placeholder="Например: Посадить новые деревья в парке">
    </div>
    <div class="form-group">
      <label for="ideaCategory">Категория:</label>
      <select id="ideaCategory">
        <option value="greening">Озеленение</option>
        <option value="improvement">Благоустройство</option>
        <option value="ecology">Экология</option>
        <option value="infrastructure">Инфраструктура</option>
        <option value="events">Мероприятия</option>
      </select>
    </div>
    <div class="form-group">
      <label for="ideaDescription">Подробное описание:</label>
      <textarea id="ideaDescription" rows="4" placeholder="Опишите вашу идею..."></textarea>
    </div>
    <div class="form-group">
      <label>Предполагаемое местоположение:</label>
      <div class="coordinates-display">
        <div class="coord">
          <span>Широта:</span>
          <span id="ideaLat">52.518600</span>
        </div>
        <div class="coord">
          <span>Долгота:</span>
          <span id="ideaLon">85.207600</span>
        </div>
      </div>
      <button class="btn btn--small" id="selectIdeaLocation">
        <i class="fas fa-map-marker-alt"></i> Указать на карте
      </button>
    </div>
    <div class="form-group">
      <label for="ideaBudget">Примерный бюджет (руб.):</label>
      <input type="number" id="ideaBudget" placeholder="100000" min="0">
    </div>
    <div class="idea-limits" id="ideaLimits">
      <p><i class="fas fa-info-circle"></i> У вас осталось <span id="ideasLeft">3</span> идей в этом месяце</p>
    </div>
    <div class="form-actions">
      <button class="btn btn--secondary" id="cancelIdea">Отмена</button>
      <button class="btn btn--primary" id="submitIdea">Предложить идею</button>
    </div>
  `;
}

function getSuggestionFormContent() {
  return `
    <div class="form-group">
      <label for="suggestionTitle">Название предложения:</label>
      <input type="text" id="suggestionTitle" placeholder="Например: Место для нового фонтана">
    </div>
    <div class="form-group">
      <label for="suggestionCategory">Категория:</label>
      <select id="suggestionCategory">
        <option value="greening">Озеленение</option>
        <option value="improvement">Благоустройство</option>
        <option value="bench">Скамейка</option>
        <option value="playground">Детская площадка</option>
        <option value="lighting">Освещение</option>
        <option value="other">Другое</option>
      </select>
    </div>
    <div class="form-group">
      <label for="suggestionDescription">Описание:</label>
      <textarea id="suggestionDescription" rows="3" placeholder="Опишите ваше предложение..."></textarea>
    </div>
    <div class="form-group">
      <label>Местоположение:</label>
      <div class="coordinates-display">
        <div class="coord">
          <span>Широта:</span>
          <span id="suggestionLat">52.518600</span>
        </div>
        <div class="coord">
          <span>Долгота:</span>
          <span id="suggestionLon">85.207600</span>
        </div>
      </div>
      <button class="btn btn--small" id="selectSuggestionLocation">
        <i class="fas fa-map-marker-alt"></i> Выбрать на карте
      </button>
    </div>
    <div class="form-actions">
      <button class="btn btn--secondary" id="cancelSuggestion">Отмена</button>
      <button class="btn btn--primary" id="submitSuggestion">Добавить предложение</button>
    </div>
  `;
}

function getVotingFormContent() {
  return `
    <div class="form-group">
      <label for="votingTitle">Название голосования:</label>
      <input type="text" id="votingTitle" placeholder="Например: Выбор места для нового сквера">
    </div>
    <div class="form-group">
      <label for="votingDescription">Описание:</label>
      <textarea id="votingDescription" rows="3" placeholder="Опишите, о чём это голосование..."></textarea>
    </div>
    <div class="form-group">
      <label for="votingType">Тип голосования:</label>
      <select id="votingType">
        <option value="idea">По выбору идеи</option>
        <option value="location">По выбору местоположения</option>
        <option value="priority">По приоритету проекта</option>
        <option value="other">Другое</option>
      </select>
    </div>
    <div class="form-group">
      <label for="votingStartDate">Дата начала:</label>
      <input type="date" id="votingStartDate">
    </div>
    <div class="form-group">
      <label for="votingEndDate">Дата окончания:</label>
      <input type="date" id="votingEndDate">
    </div>
    <div class="form-group">
      <label for="votingMinVotes">Минимальное количество голосов:</label>
      <input type="number" id="votingMinVotes" placeholder="100" min="1" value="100">
    </div>
    <div class="form-actions">
      <button class="btn btn--secondary" id="cancelVoting">Отмена</button>
      <button class="btn btn--primary" id="submitVoting">Создать голосование</button>
    </div>
  `;
}

function initSidebarForm(type) {
  // Закрытие сайдбара
  document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
  
  // Общие кнопки отмены
  document.getElementById('cancelIdea')?.addEventListener('click', closeSidebar);
  document.getElementById('cancelSuggestion')?.addEventListener('click', closeSidebar);
  document.getElementById('cancelVoting')?.addEventListener('click', closeSidebar);
  
  // Отправка форм (упрощённо)
  if (type === 'idea') {
    document.getElementById('submitIdea').addEventListener('click', submitIdeaFromSidebar);
    document.getElementById('selectIdeaLocation').addEventListener('click', selectIdeaLocation);
  } else if (type === 'suggestion') {
    document.getElementById('submitSuggestion').addEventListener('click', submitSuggestionFromSidebar);
    document.getElementById('selectSuggestionLocation').addEventListener('click', selectSuggestionLocation);
  } else if (type === 'voting') {
    document.getElementById('submitVoting').addEventListener('click', submitVotingFromSidebar);
  }
}
function submitIdeaFromSidebar() {
  console.log('Идея отправлена из сайдбара');
  // Здесь будет логика отправки идеи
  closeSidebar();
  showNotification('Идея успешно отправлена!', 'success');
}

function submitSuggestionFromSidebar() {
  console.log('Предложение отправлено из сайдбара');
  closeSidebar();
  showNotification('Предложение добавлено!', 'success');
}

function submitVotingFromSidebar() {
  console.log('Голосование создано из сайдбара');
  closeSidebar();
  showNotification('Голосование создано!', 'success');
}

function selectIdeaLocation() {
  const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
  const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
  document.getElementById('ideaLat').textContent = lat;
  document.getElementById('ideaLon').textContent = lon;
  showNotification('Координаты установлены', 'success');
}

function selectSuggestionLocation() {
  const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
  const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
  document.getElementById('suggestionLat').textContent = lat;
  document.getElementById('suggestionLon').textContent = lon;
  showNotification('Координаты установлены', 'success');
}
// ============================================================================
// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
// ============================================================================
window.showNotification = showNotification;
window.openProblemModalForObject = function(object) {
    openProblemModal();
    // Можно добавить логику для предзаполнения формы
};


