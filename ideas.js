// Система банка идей

class IdeasSystem {
    constructor() {
        this.ideas = [];
        this.suggestions = []; // Точки с предложениями от пользователей
        this.currentFilter = 'new';
        this.initialize();
    }
    
    async initialize() {
        await this.loadIdeas();
        await this.loadSuggestions();
        this.setupEventListeners();
        this.renderIdeas();
    }
    
    async loadIdeas() {
        try {
            const username = CONFIG?.GITHUB_USERNAME || 'ecopuls22-sys';
            const repo = CONFIG?.REPO_NAME || 'eco-biyisk-map';
            const url = `https://raw.githubusercontent.com/${username}/${repo}/main/data/ideas.json`;
            
            const response = await fetch(url + '?t=' + Date.now());
            if (response.ok) {
                this.ideas = await response.json();
            } else {
                this.ideas = this.getDefaultIdeas();
            }
        } catch (error) {
            console.error('Ошибка загрузки идей:', error);
            this.ideas = this.getDefaultIdeas();
        }
        
        this.updateStats();
    }
    
    async loadSuggestions() {
        try {
            const username = CONFIG?.GITHUB_USERNAME || 'ecopuls22-sys';
            const repo = CONFIG?.REPO_NAME || 'eco-biyisk-map';
            const url = `https://raw.githubusercontent.com/${username}/${repo}/main/data/suggestions.json`;
            
            const response = await fetch(url + '?t=' + Date.now());
            if (response.ok) {
                this.suggestions = await response.json();
            }
        } catch (error) {
            console.error('Ошибка загрузки предложений:', error);
            this.suggestions = [];
        }
    }
    
    getDefaultIdeas() {
        return [
            {
                id: 1,
                title: 'Создание нового сквера на ул. Ленина',
                category: 'greening',
                description: 'Предлагаю создать новый сквер на пустыре по ул. Ленина, 45. Там достаточно места для посадки деревьев и установки скамеек.',
                author: 'Иван Петров',
                authorRole: 'resident',
                authorId: 'user_12345',
                status: 'new',
                votes: { up: 45, down: 12 },
                comments: 8,
                budget: 500000,
                location: [52.5190, 85.2080],
                date: '2024-01-15',
                expertReview: null,
                votingId: null,
                photos: []
            },
            {
                id: 2,
                title: 'Установка велопарковок в центре города',
                category: 'infrastructure',
                description: 'Для развития велодвижения предлагаю установить 10 велопарковок в центре города.',
                author: 'Анна Сидорова',
                authorRole: 'resident',
                authorId: 'user_67890',
                status: 'approved',
                votes: { up: 120, down: 15 },
                comments: 25,
                budget: 200000,
                location: [52.5200, 85.2100],
                date: '2024-01-10',
                expertReview: 'Идея актуальна, соответствует программе развития транспорта',
                votingId: 1,
                photos: []
            }
        ];
    }
    
    setupEventListeners() {
        // Кнопка предложить идею
        const suggestBtn = document.getElementById('suggestIdeaBtn');
        if (suggestBtn) {
            suggestBtn.addEventListener('click', () => this.openIdeaModal());
        }
        
        // Кнопка на карте
        const addIdeaBtn = document.getElementById('addIdeaBtn');
        if (addIdeaBtn) {
            addIdeaBtn.addEventListener('click', () => this.openIdeaModal());
        }
        
        // Кнопка добавить точку-предложение на карте
        const addSuggestionBtn = document.getElementById('addSuggestionBtn');
        if (addSuggestionBtn) {
            addSuggestionBtn.addEventListener('click', () => this.openSuggestionModal());
        }
        
        // Вкладки
        document.querySelectorAll('.ideas-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Модальное окно идеи
        document.getElementById('cancelIdea')?.addEventListener('click', () => this.closeIdeaModal());
        document.getElementById('submitIdea')?.addEventListener('click', () => this.submitIdea());
        document.getElementById('selectIdeaLocation')?.addEventListener('click', () => this.selectIdeaLocation());
        
        // Модальное окно предложения
        document.getElementById('cancelSuggestion')?.addEventListener('click', () => this.closeSuggestionModal());
        document.getElementById('submitSuggestion')?.addEventListener('click', () => this.submitSuggestion());
        document.getElementById('selectSuggestionLocation')?.addEventListener('click', () => this.selectSuggestionLocation());
    }
    
    openIdeaModal() {
        if (!authSystem.checkPermission('add_idea')) {
            authSystem.showNotification('У вас недостаточно прав для предложения идей', 'error');
            return;
        }
        
        if (!authSystem.canSubmitIdea()) {
            authSystem.showNotification('Вы исчерпали лимит идей на этот месяц', 'error');
            return;
        }
        
        document.getElementById('ideaModal').style.display = 'flex';
        this.resetIdeaForm();
    }
    
    openSuggestionModal() {
        if (!authSystem.checkPermission('add_suggestion')) {
            authSystem.showNotification('У вас недостаточно прав для добавления предложений', 'error');
            return;
        }
        
        document.getElementById('suggestionModal').style.display = 'flex';
        this.resetSuggestionForm();
    }
    
    closeIdeaModal() {
        document.getElementById('ideaModal').style.display = 'none';
    }
    
    closeSuggestionModal() {
        document.getElementById('suggestionModal').style.display = 'none';
    }
    
    resetIdeaForm() {
        document.getElementById('ideaTitle').value = '';
        document.getElementById('ideaDescription').value = '';
        document.getElementById('ideaBudget').value = '';
        document.getElementById('ideaLat').textContent = '52.518600';
        document.getElementById('ideaLon').textContent = '85.207600';
    }
    
    resetSuggestionForm() {
        document.getElementById('suggestionTitle').value = '';
        document.getElementById('suggestionDescription').value = '';
        document.getElementById('suggestionCategory').value = 'greening';
        document.getElementById('suggestionLat').textContent = '52.518600';
        document.getElementById('suggestionLon').textContent = '85.207600';
    }
    
    selectIdeaLocation() {
        // В реальном приложении здесь будет выбор на карте
        const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
        const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
        
        document.getElementById('ideaLat').textContent = lat;
        document.getElementById('ideaLon').textContent = lon;
        
        authSystem.showNotification('Координаты установлены', 'success');
    }
    
    selectSuggestionLocation() {
        // В реальном приложении здесь будет выбор на карте
        const lat = (52.5186 + (Math.random() - 0.5) * 0.01).toFixed(6);
        const lon = (85.2076 + (Math.random() - 0.5) * 0.01).toFixed(6);
        
        document.getElementById('suggestionLat').textContent = lat;
        document.getElementById('suggestionLon').textContent = lon;
        
        authSystem.showNotification('Координаты установлены', 'success');
    }
    
    async submitIdea() {
        const title = document.getElementById('ideaTitle').value.trim();
        const description = document.getElementById('ideaDescription').value.trim();
        const category = document.getElementById('ideaCategory').value;
        const budget = parseInt(document.getElementById('ideaBudget').value) || 0;
        const lat = parseFloat(document.getElementById('ideaLat').textContent);
        const lon = parseFloat(document.getElementById('ideaLon').textContent);
        
        if (!title || !description) {
            authSystem.showNotification('Заполните название и описание идеи', 'error');
            return;
        }
        
        if (!authSystem.canSubmitIdea()) {
            authSystem.showNotification('Лимит идей исчерпан', 'error');
            return;
        }
        
        const userInfo = authSystem.getUserInfo();
        
        const newIdea = {
            id: Date.now(),
            title: title,
            category: category,
            description: description,
            author: userInfo.roleName,
            authorRole: userInfo.role,
            authorId: userInfo.id,
            status: 'new',
            votes: { up: 0, down: 0 },
            comments: 0,
            budget: budget,
            location: [lat, lon],
            date: new Date().toISOString().split('T')[0],
            expertReview: null,
            votingId: null,
            photos: []
        };
        
        // В реальном приложении здесь будет отправка на сервер
        // Для демо просто добавляем локально
        this.ideas.unshift(newIdea);
        authSystem.registerIdeaSubmission(newIdea.id);
        
        this.updateStats();
        this.renderIdeas();
        this.closeIdeaModal();
        
        authSystem.showNotification('Идея успешно отправлена на модерацию!', 'success');
        
        // Сохраняем в localStorage для демо
        this.saveToLocalStorage();
        
        // Добавляем точку на карту
        if (window.addIdeaToMap) {
            window.addIdeaToMap(newIdea);
        }
    }
    
    async submitSuggestion() {
        const title = document.getElementById('suggestionTitle').value.trim();
        const description = document.getElementById('suggestionDescription').value.trim();
        const category = document.getElementById('suggestionCategory').value;
        const lat = parseFloat(document.getElementById('suggestionLat').textContent);
        const lon = parseFloat(document.getElementById('suggestionLon').textContent);
        
        if (!title) {
            authSystem.showNotification('Заполните название предложения', 'error');
            return;
        }
        
        const userInfo = authSystem.getUserInfo();
        
        const newSuggestion = {
            id: Date.now(),
            title: title,
            category: category,
            description: description,
            author: userInfo.roleName,
            authorRole: userInfo.role,
            authorId: userInfo.id,
            location: [lat, lon],
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            votes: 0,
            comments: []
        };
        
        // Добавляем в локальный массив
        this.suggestions.push(newSuggestion);
        
        // Сохраняем
        await this.saveSuggestionToGitHub(newSuggestion);
        this.closeSuggestionModal();
        
        authSystem.showNotification('Предложение добавлено на карту!', 'success');
        
        // Добавляем точку на карту
        if (window.addSuggestionToMap) {
            window.addSuggestionToMap(newSuggestion);
        }
    }
    
    async saveSuggestionToGitHub(suggestion) {
        try {
            // Обновляем локальные данные
            this.suggestions = [...this.suggestions, suggestion];
            
            // Для демо сохраняем в localStorage
            localStorage.setItem('eco_suggestions_data', JSON.stringify(this.suggestions));
            
            // В реальном приложении здесь будет вызов GitHub API
            console.log('Сохранение предложения в GitHub:', suggestion);
            
        } catch (error) {
            console.error('Ошибка сохранения предложения:', error);
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('eco_ideas_data', JSON.stringify(this.ideas));
    }
    
    switchTab(tab) {
        this.currentFilter = tab;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.ideas-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        this.renderIdeas();
    }
    
    renderIdeas() {
        const container = document.getElementById('ideasList');
        if (!container) return;
        
        let filteredIdeas = this.ideas;
        
        // Фильтрация по вкладке
        switch(this.currentFilter) {
            case 'new':
                filteredIdeas = this.ideas.filter(idea => idea.status === 'new');
                break;
            case 'voting':
                filteredIdeas = this.ideas.filter(idea => idea.votingId);
                break;
            case 'approved':
                filteredIdeas = this.ideas.filter(idea => idea.status === 'approved');
                break;
            case 'my':
                const userId = authSystem.userId;
                filteredIdeas = this.ideas.filter(idea => idea.authorId === userId);
                break;
        }
        
        if (filteredIdeas.length === 0) {
            container.innerHTML = '<div class="empty-state">Идей пока нет</div>';
            return;
        }
        
        container.innerHTML = filteredIdeas.map(idea => this.createIdeaCard(idea)).join('');
        
        // Добавляем обработчики событий
        this.addIdeaEventListeners();
    }
    
    createIdeaCard(idea) {
        const statusLabels = {
            new: { text: 'На рассмотрении', class: 'status-new' },
            review: { text: 'На экспертизе', class: 'status-inwork' },
            voting: { text: 'На голосовании', class: 'status-inwork' },
            approved: { text: 'Одобрено', class: 'status-approved' },
            rejected: { text: 'Отклонено', class: 'status-solved' }
        };
        
        const status = statusLabels[idea.status] || statusLabels.new;
        
        const categoryLabels = {
            greening: 'Озеленение',
            improvement: 'Благоустройство',
            ecology: 'Экология',
            infrastructure: 'Инфраструктура',
            events: 'Мероприятия'
        };
        
        return `
            <div class="idea-card" data-id="${idea.id}">
                <div class="idea-header">
                    <div class="idea-title">${idea.title}</div>
                    <div class="idea-category">${categoryLabels[idea.category] || idea.category}</div>
                </div>
                
                <div class="idea-meta">
                    <span><i class="far fa-user"></i> ${idea.author}</span>
                    <span><i class="far fa-calendar"></i> ${idea.date}</span>
                    <span><i class="fas fa-ruble-sign"></i> ${idea.budget.toLocaleString()} руб.</span>
                </div>
                
                <p class="idea-description">${idea.description}</p>
                
                <div class="idea-stats">
                    <div class="idea-stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${idea.votes.up}</span>
                    </div>
                    <div class="idea-stat">
                        <i class="fas fa-thumbs-down"></i>
                        <span>${idea.votes.down}</span>
                    </div>
                    <div class="idea-stat">
                        <i class="far fa-comment"></i>
                        <span>${idea.comments}</span>
                    </div>
                </div>
                
                ${idea.expertReview ? `
                    <div class="expert-review">
                        <strong>Экспертная оценка:</strong>
                        <p>${idea.expertReview}</p>
                    </div>
                ` : ''}
                
                ${idea.status === 'voting' && idea.votingId ? `
                    <div class="idea-actions">
                        <button class="btn btn--small btn-vote" data-voting="${idea.votingId}">
                            <i class="fas fa-vote-yea"></i> Голосовать
                        </button>
                    </div>
                ` : ''}
                
                ${authSystem.checkPermission('moderate') ? `
                    <div class="moderate-actions">
                        <button class="btn btn--small btn-approve" data-id="${idea.id}">
                            <i class="fas fa-check"></i> Одобрить
                        </button>
                        <button class="btn btn--small btn-reject" data-id="${idea.id}">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    addIdeaEventListeners() {
        // Голосование за идеи
        document.querySelectorAll('.btn-vote').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const votingId = e.currentTarget.dataset.voting;
                if (window.votingSystem && window.switchScreen) {
                    window.switchScreen('voting');
                    // Здесь можно перейти к конкретному голосованию
                }
            });
        });
        
        // Модерация (только для админов)
        if (authSystem.checkPermission('moderate')) {
            document.querySelectorAll('.btn-approve').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const ideaId = parseInt(e.currentTarget.dataset.id);
                    this.approveIdea(ideaId);
                });
            });
            
            document.querySelectorAll('.btn-reject').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const ideaId = parseInt(e.currentTarget.dataset.id);
                    this.rejectIdea(ideaId);
                });
            });
        }
    }
    
    approveIdea(ideaId) {
        const idea = this.ideas.find(i => i.id === ideaId);
        if (idea) {
            idea.status = 'approved';
            this.updateStats();
            this.renderIdeas();
            authSystem.showNotification('Идея одобрена!', 'success');
            this.saveToLocalStorage();
        }
    }
    
    rejectIdea(ideaId) {
        const idea = this.ideas.find(i => i.id === ideaId);
        if (idea) {
            idea.status = 'rejected';
            this.updateStats();
            this.renderIdeas();
            authSystem.showNotification('Идея отклонена', 'warning');
            this.saveToLocalStorage();
        }
    }
    
    updateStats() {
        const total = this.ideas.length;
        const newIdeas = this.ideas.filter(i => i.status === 'new').length;
        const approved = this.ideas.filter(i => i.status === 'approved').length;
        const rejected = this.ideas.filter(i => i.status === 'rejected').length;
        
        document.getElementById('ideasTotal')?.textContent = total;
        document.getElementById('ideasNew')?.textContent = newIdeas;
        document.getElementById('ideasApproved')?.textContent = approved;
        document.getElementById('ideasRejected')?.textContent = rejected;
    }
}

// Инициализация системы идей
let ideasSystem;

document.addEventListener('DOMContentLoaded', () => {
    ideasSystem = new IdeasSystem();
    window.ideasSystem = ideasSystem;
});
