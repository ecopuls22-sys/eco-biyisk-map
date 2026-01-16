// ============================================================================
// КОНФИГУРАЦИЯ ПРОЕКТА
// ============================================================================
const CONFIG = {
    GITHUB_USERNAME: 'YOUR_GITHUB_USERNAME', // ⬅️ ЗАМЕНИТЕ НА ВАШ ЛОГИН!
    REPO_NAME: 'eco-biyisk-map',
    DATA_FILE: 'data/objects.json',
    ISSUES_URL: 'https://github.com/YOUR_USERNAME/eco-biyisk-map/issues/new?template=new-object.md'
};

// Динамически обновляем ISSUES_URL
CONFIG.ISSUES_URL = `https://github.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/issues/new?template=new-object.md`;
const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/main/${CONFIG.DATA_FILE}`;

// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================================
let myMap;
let currentObjects = [];
let userPlacemark = null;
let lastUpdateTime = null;

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ
// ============================================================================
ymaps.ready(async function init() {
    console.log('🌳 Экологическая карта Бийска - Загрузка...');
    
    // Создаем карту
    myMap = new ymaps.Map('map', {
        center: [52.5186, 85.2076], // Центр Бийска
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
    
    // Периодическое обновление данных (каждые 5 минут)
    setInterval(loadData, 5 * 60 * 1000);
    
    console.log('✅ Карта готова! Объектов:', currentObjects.length);
});

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================
async function loadData() {
    try {
        showNotification('Обновляем данные...', 'info');
        
        // Добавляем случайный параметр для избежания кэширования
        const url = `${DATA_URL}?t=${Date.now()}&rand=${Math.random()}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Проверяем, изменились ли данные
        if (JSON.stringify(currentObjects) !== JSON.stringify(data)) {
            currentObjects = data;
            
            // Очищаем карту
            myMap.geoObjects.removeAll();
            
            // Добавляем все объекты
            data.forEach(obj => {
                addObjectToMap(obj);
            });
            
            // Обновляем интерфейс
            updateObjectsList();
            updateStatistics();
            
            lastUpdateTime = new Date();
            updateLastUpdateTime();
            
            console.log(`✅ Данные обновлены: ${data.length} объектов`);
            showNotification(`Данные обновлены (${data.length} объектов)`, 'success');
        } else {
            console.log('📭 Данные не изменились');
            showNotification('Данные актуальны', 'info');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        
        // Пробуем загрузить из localStorage как запасной вариант
        const localData = localStorage.getItem('eco_biysk_backup');
        if (localData) {
            currentObjects = JSON.parse(localData);
            showNotification('Используем локальную копию данных', 'warning');
        } else {
            // Используем демо-данные
            currentObjects = getDefaultObjects();
            showNotification('Используем демо-данные', 'info');
        }
        
        // Очищаем и перерисовываем
        myMap.geoObjects.removeAll();
        currentObjects.forEach(obj => addObjectToMap(obj));
        updateObjectsList();
        updateStatistics();
        
        lastUpdateTime = new Date();
        updateLastUpdateTime();
    }
}

// ============================================================================
// РАБОТА С КАРТОЙ
// ============================================================================
function addObjectToMap(obj) {
    const iconColor = getColorByType(obj.type);
    const iconGlyph = getIconByType(obj.type);
    
    // Создаем контент для балуна
    const balloonContent = `
        <div class="balloon-content">
            <div class="balloon-header">
                <h4>${obj.name}</h4>
                <span class="object-type ${obj.type}">${getTypeName(obj.type)}</span>
            </div>
            <div class="balloon-body">
                ${obj.description ? `<p><i class="fas fa-info-circle"></i> ${obj.description}</p>` : ''}
                <p><i class="fas fa-map-marker-alt"></i> Координаты: ${obj.coords[0].toFixed(6)}, ${obj.coords[1].toFixed(6)}</p>
                <p><i class="fas fa-heartbeat" style="color: ${getConditionColor(obj.condition)}"></i> Состояние: ${getConditionName(obj.condition)}</p>
                ${obj.date ? `<p><i class="fas fa-calendar"></i> Добавлено: ${obj.date}</p>` : ''}
            </div>
        </div>
    `;
    
    const placemark = new ymaps.Placemark(
        obj.coords,
        {
            balloonContent: balloonContent,
            hintContent: obj.name
        },
        {
            preset: 'islands#circleIcon',
            iconColor: iconColor,
            iconGlyph: iconGlyph,
            balloonCloseButton: true,
            hideIconOnBalloonOpen: false
        }
    );
    
    // Сохраняем ссылку на метку
    obj.placemark = placemark;
    
    // Добавляем на карту
    myMap.geoObjects.add(placemark);
}

// ============================================================================
// ИНТЕРФЕЙС ПОЛЬЗОВАТЕЛЯ
// ============================================================================
function initializeUI() {
    // Кнопка показа объектов
    document.getElementById('showObjectsBtn').addEventListener('click', function() {
        document.getElementById('objectsPanel').classList.add('active');
        updateObjectsList();
    });
    
    // Кнопка закрытия панели объектов
    document.getElementById('closeObjectsPanel').addEventListener('click', function() {
        document.getElementById('objectsPanel').classList.remove('active');
    });
    
    // Кнопка обновления данных
    document.getElementById('refreshBtn').addEventListener('click', async function() {
        this.classList.add('rotating');
        await loadData();
        setTimeout(() => this.classList.remove('rotating'), 500);
    });
    
    // Кнопка "Добавить"
    document.getElementById('addBtn').addEventListener('click', function() {
        // Открываем форму на GitHub
        window.open(CONFIG.ISSUES_URL, '_blank');
        
        // Показываем инструкцию
        document.getElementById('infoModal').style.display = 'flex';
    });
    
    // Закрытие модального окна
    document.getElementById('closeModal').addEventListener('click', function() {
        document.getElementById('infoModal').style.display = 'none';
    });
    
    // Закрытие модального окна по клику вне его
    document.getElementById('infoModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
    
    // Кнопка "Найти меня"
    document.getElementById('locateBtn').addEventListener('click', locateUser);
    
    // Фильтры в легенде
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
    const legendToggle = document.getElementById('legendToggle');
    if (legendToggle) {
        legendToggle.addEventListener('click', function() {
            const body = document.getElementById('legendBody');
            const icon = this.querySelector('i');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                body.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        });
    }
    
    // Поиск объектов
    const searchInput = document.getElementById('searchObjects');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterObjectsBySearch(this.value);
        });
    }
    
    // Сохраняем ссылки в навигации
    document.querySelectorAll('.nav__link[href*="github.com"]').forEach(link => {
        const href = link.getAttribute('href');
        link.setAttribute('href', href.replace('YOUR_USERNAME', CONFIG.GITHUB_USERNAME));
    });
    
    // Добавляем CSS для вращения
    const style = document.createElement('style');
    style.textContent = `
        .rotating {
            animation: rotate 0.5s linear;
        }
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// ФУНКЦИИ ИНТЕРФЕЙСА
// ============================================================================
function updateObjectsList() {
    const objectsList = document.getElementById('objectsList');
    if (!objectsList) return;
    
    objectsList.innerHTML = '';
    
    currentObjects.forEach(obj => {
        const card = document.createElement('div');
        card.className = 'object-card';
        card.innerHTML = `
            <div class="object-card__header">
                <div class="object-card__title">${obj.name}</div>
                <div class="object-card__type ${obj.type}">${getTypeName(obj.type)}</div>
            </div>
            <div class="object-card__info">
                <p><i class="fas fa-map-marker-alt"></i> ${obj.coords[0].toFixed(4)}, ${obj.coords[1].toFixed(4)}</p>
                ${obj.description ? `<p><i class="fas fa-info-circle"></i> ${obj.description.substring(0, 50)}${obj.description.length > 50 ? '...' : ''}</p>` : ''}
            </div>
            <div class="object-card__condition">
                <i class="fas fa-${getConditionIcon(obj.condition)}" style="color: ${getConditionColor(obj.condition)}"></i>
                ${getConditionName(obj.condition)}
            </div>
        `;
        
        card.addEventListener('click', function() {
            // Центрируем карту на объекте
            myMap.setCenter(obj.coords, 16);
            
            // Открываем балун
            if (obj.placemark) {
                obj.placemark.balloon.open();
            }
            
            // Закрываем панель на мобильных
            if (window.innerWidth < 768) {
                document.getElementById('objectsPanel').classList.remove('active');
            }
        });
        
        objectsList.appendChild(card);
    });
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

function filterObjectsBySearch(query) {
    if (!query.trim()) {
        // Показываем все
        currentObjects.forEach(obj => {
            if (obj.placemark) {
                obj.placemark.options.set('visible', true);
            }
        });
        return;
    }
    
    const searchLower = query.toLowerCase();
    
    currentObjects.forEach(obj => {
        const visible = obj.name.toLowerCase().includes(searchLower) || 
                       (obj.description && obj.description.toLowerCase().includes(searchLower));
        
        if (obj.placemark) {
            obj.placemark.options.set('visible', visible);
        }
    });
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

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
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

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ДАННЫМИ
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

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Экологическая карта Бийска запущена');
    console.log('👤 Пользователь GitHub:', CONFIG.GITHUB_USERNAME);
    console.log('📦 Репозиторий:', CONFIG.REPO_NAME);
    console.log('📊 URL данных:', DATA_URL);
    
    // Периодическое обновление времени
    setInterval(updateLastUpdateTime, 60000);
});