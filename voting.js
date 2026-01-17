// Система приоритетных голосований

class VotingSystem {
    constructor() {
        this.votings = [];
        this.currentTab = 'active';
        this.initialize();
    }
    
    async initialize() {
        await this.loadVotings();
        this.setupEventListeners();
        this.renderVotings();
    }
    
    async loadVotings() {
        try {
            const username = CONFIG?.GITHUB_USERNAME || 'ecopuls22-sys';
            const repo = CONFIG?.REPO_NAME || 'eco-biyisk-map';
            const url = `https://raw.githubusercontent.com/${username}/${repo}/main/data/votes.json`;
            
            const response = await fetch(url + '?t=' + Date.now());
            if (response.ok) {
                this.votings = await response.json();
            } else {
                this.votings = this.getDefaultVotings();
            }
        } catch (error) {
            console.error('Ошибка загрузки голосований:', error);
            this.votings = this.getDefaultVotings();
        }
        
        this.updateStats();
    }
    
    getDefaultVotings() {
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        return [
            {
                id: 1,
                title: 'Выбор места для нового сквера',
                description: 'Голосование за лучшее место для создания нового сквера в рамках программы озеленения.',
                type: 'location',
                status: 'active',
                startDate: weekAgo.toISOString().split('T')[0],
                endDate: weekLater.toISOString().split('T')[0],
                options: [
                    { id: 1, text: 'Ул. Ленина, 45 (пустырь)', votes: 145 },
                    { id: 2, text: 'Парк Победы (расширение)', votes: 89 },
                    { id: 3, text: 'Микрорайон Зелёный', votes: 67 }
                ],
                totalVotes: 301,
                minVotes: 100,
                createdBy: 'Администратор',
                createdById: 'admin_001',
                ideaId: 2,
                createdAt: '2024-01-10'
            },
            {
                id: 2,
                title: 'Приоритеты благоустройства на 2024 год',
                description: 'Выберите, на что в первую очередь направить бюджет благоустройства.',
                type: 'priority',
                status: 'coming',
                startDate: weekLater.toISOString().split('T')[0],
                endDate: new Date(weekLater.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                options: [
                    { id: 1, text: 'Ремонт дорог и тротуаров', votes: 0 },
                    { id: 2, text: 'Озеленение и парки', votes: 0 },
                    { id: 3, text: 'Детские площадки', votes: 0 },
                    { id: 4, text: 'Освещение улиц', votes: 0 }
                ],
                totalVotes: 0,
                minVotes: 200,
                createdBy: 'Администратор',
                createdById: 'admin_001',
                ideaId: null,
                createdAt: '2024-01-15'
            },
            {
                id: 3,
                title: 'Выбор деревьев для посадки весной',
                description: 'Решите, какие деревья лучше всего посадить в рамках весенней программы озеленения.',
                type: 'idea',
                status: 'finished',
                startDate: '2024-01-01',
                endDate: '2024-01-10',
                options: [
                    { id: 1, text: 'Березы', votes: 120 },
                    { id: 2, text: 'Клены', votes: 85 },
                    { id: 3, text: 'Липы', votes: 67 },
                    { id: 4, text: 'Тополя', votes: 45 }
                ],
                totalVotes: 317,
                minVotes: 100,
                createdBy: 'Администратор',
                createdById: 'admin_001',
                ideaId: 1,
                createdAt: '2023-12-20'
            }
        ];
    }
    
    setupEventListeners() {
        // Вкладки
        document.querySelectorAll('.voting-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Создание голосования (для админов)
        const createVotingBtn = document.getElementById('createVotingBtn');
        if (createVotingBtn) {
            createVotingBtn.addEventListener('click', () => this.openCreateVotingModal());
        }
    }
    
    switchTab(tab) {
        this.currentTab = tab;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.voting-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        this.renderVotings();
    }
    
    renderVotings() {
        const container = document.getElementById('votingList');
        if (!container) return;
        
        let filteredVotings = this.votings;
        
        // Фильтрация по вкладке
        switch(this.currentTab) {
            case 'active':
                filteredVotings = this.votings.filter(v => v.status === 'active');
                break;
            case 'coming':
                filteredVotings = this.votings.filter(v => v.status === 'coming');
                break;
            case 'finished':
                filteredVotings = this.votings.filter(v => v.status === 'finished');
                break;
            case 'results':
                filteredVotings = this.votings.filter(v => v.status === 'finished');
                break;
        }
        
        if (filteredVotings.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-vote-yea"></i> Голосований пока нет</div>';
            return;
        }
        
        if (this.currentTab === 'results') {
            container.innerHTML = filteredVotings.map(voting => this.createResultsCard(voting)).join('');
        } else {
            container.innerHTML = filteredVotings.map(voting => this.createVotingCard(voting)).join('');
        }
        
        // Добавляем обработчики событий
        this.addVotingEventListeners();
    }
    
    createVotingCard(voting) {
        // Проверяем статус на основе дат
        const now = new Date();
        const startDate = new Date(voting.startDate);
        const endDate = new Date(voting.endDate);
        
        let status = voting.status;
        if (now < startDate) {
            status = 'coming';
        } else if (now > endDate) {
            status = 'finished';
        } else if (now >= startDate && now <= endDate) {
            status = 'active';
        }
        
        // Обновляем статус в данных
        if (voting.status !== status) {
            voting.status = status;
            this.saveToLocalStorage();
        }
        
        const statusLabels = {
            active: { text: 'Активно', class: 'status-active' },
            coming: { text: 'Скоро', class: 'status-coming' },
            finished: { text: 'Завершено', class: 'status-finished' }
        };
        
        const statusInfo = statusLabels[status] || statusLabels.finished;
        const hasVoted = authSystem.hasVoted(voting.id);
        const canVote = authSystem.checkPermission('vote') && !hasVoted && status === 'active';
        
        return `
            <div class="voting-card ${status === 'active' ? 'active' : ''}" data-id="${voting.id}">
                <div class="voting-header">
                    <div class="voting-title">${voting.title}</div>
                    <div class="voting-status ${statusInfo.class}">${statusInfo.text}</div>
                </div>
                
                <p class="voting-description">${voting.description}</p>
                
                <div class="voting-dates">
                    <span><i class="far fa-calendar-alt"></i> Начало: ${voting.startDate}</span>
                    <span><i class="far fa-calendar-times"></i> Окончание: ${voting.endDate}</span>
                </div>
                
                ${status === 'active' || status === 'finished' ? `
                    <div class="voting-progress">
                        <div class="progress-label">
                            <span>Прогресс голосования:</span>
                            <span>${voting.totalVotes} / ${voting.minVotes}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, (voting.totalVotes / voting.minVotes) * 100)}%"></div>
                        </div>
                    </div>
                ` : ''}
                
                ${status === 'active' ? `
                    <div class="voting-options">
                        ${voting.options.map(option => `
                            <div class="voting-option ${hasVoted && authSystem.userIdeas.votes[voting.id] === option.id ? 'selected' : ''}" 
                                 data-option="${option.id}">
                                ${option.text}
                                ${hasVoted ? `<span class="vote-count">${option.votes} голосов</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    ${canVote ? `
                        <div class="voting-actions">
                            <button class="btn btn--primary btn-submit-vote" data-id="${voting.id}">
                                <i class="fas fa-vote-yea"></i> Проголосовать
                            </button>
                        </div>
                    ` : hasVoted ? `
                        <div class="voted-message">
                            <i class="fas fa-check-circle"></i> Вы уже проголосовали в этом голосовании
                        </div>
                    ` : ''}
                ` : ''}
                
                ${status === 'finished' ? `
                    <div class="voting-results">
                        <h4>Предварительные результаты:</h4>
                        ${voting.options.map(option => {
                            const percent = voting.totalVotes > 0 ? (option.votes / voting.totalVotes * 100) : 0;
                            return `
                                <div class="result-item">
                                    <div class="result-header">
                                        <span>${option.text}</span>
                                        <span>${option.votes} голосов (${percent.toFixed(1)}%)</span>
                                    </div>
                                    <div class="result-bar">
                                        <div class="result-fill" style="width: ${percent}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                
                <div class="voting-meta">
                    <span><i class="far fa-user"></i> Создано: ${voting.createdBy}</span>
                    ${voting.ideaId ? `<span><i class="fas fa-lightbulb"></i> Привязано к идее #${voting.ideaId}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    createResultsCard(voting) {
        // Сортируем по количеству голосов
        const sortedOptions = [...voting.options].sort((a, b) => b.votes - a.votes);
        const winner = sortedOptions[0];
        const totalVotes = voting.totalVotes;
        
        return `
            <div class="voting-card" data-id="${voting.id}">
                <div class="voting-header">
                    <div class="voting-title">${voting.title}</div>
                    <div class="voting-status status-finished">Завершено</div>
                </div>
                
                <div class="results-summary">
                    <div class="winner">
                        <i class="fas fa-trophy"></i>
                        <strong>Победитель:</strong> ${winner.text}
                    </div>
                    <div class="total-votes">
                        <i class="fas fa-users"></i>
                        Всего голосов: <strong>${totalVotes}</strong>
                    </div>
                    ${voting.minVotes ? `
                        <div class="min-votes">
                            <i class="fas fa-chart-line"></i>
                            Минимум для решения: <strong>${voting.minVotes}</strong>
                        </div>
                    ` : ''}
                </div>
                
                <div class="detailed-results">
                    ${sortedOptions.map((option, index) => {
                        const percent = totalVotes > 0 ? (option.votes / totalVotes * 100) : 0;
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                        
                        return `
                            <div class="result-item ${index < 3 ? 'podium' : ''}">
                                <div class="result-rank">
                                    ${medal} ${index + 1} место
                                </div>
                                <div class="result-content">
                                    <div class="result-header">
                                        <span>${option.text}</span>
                                        <span>${option.votes} голосов (${percent.toFixed(1)}%)</span>
                                    </div>
                                    <div class="result-bar">
                                        <div class="result-fill" style="width: ${percent}%"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="voting-meta">
                    <span><i class="far fa-calendar-alt"></i> ${voting.startDate} - ${voting.endDate}</span>
                    <span><i class="far fa-user"></i> Создано: ${voting.createdBy}</span>
                </div>
            </div>
        `;
    }
    
    addVotingEventListeners() {
        // Выбор варианта голосования
        document.querySelectorAll('.voting-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (!authSystem.checkPermission('vote')) {
                    authSystem.showNotification('Для голосования выберите роль "Житель" или выше', 'error');
                    return;
                }
                
                const votingCard = e.currentTarget.closest('.voting-card');
                const votingId = parseInt(votingCard.dataset.id);
                const voting = this.votings.find(v => v.id === votingId);
                
                if (voting.status !== 'active') return;
                if (authSystem.hasVoted(votingId)) return;
                
                // Снимаем выделение с других вариантов
                votingCard.querySelectorAll('.voting-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Выделяем выбранный
                e.currentTarget.classList.add('selected');
                
                // Активируем кнопку голосования
                const submitBtn = votingCard.querySelector('.btn-submit-vote');
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
            });
        });
        
        // Отправка голоса
        document.querySelectorAll('.btn-submit-vote').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const votingId = parseInt(e.currentTarget.dataset.id);
                this.submitVote(votingId);
            });
        });
    }
    
    submitVote(votingId) {
        const votingCard = document.querySelector(`.voting-card[data-id="${votingId}"]`);
        if (!votingCard) return;
        
        const selectedOption = votingCard.querySelector('.voting-option.selected');
        if (!selectedOption) {
            authSystem.showNotification('Выберите вариант для голосования', 'error');
            return;
        }
        
        const optionId = parseInt(selectedOption.dataset.option);
        const voting = this.votings.find(v => v.id === votingId);
        
        if (!voting || voting.status !== 'active') {
            authSystem.showNotification('Голосование завершено или не активно', 'error');
            return;
        }
        
        if (authSystem.hasVoted(votingId)) {
            authSystem.showNotification('Вы уже голосовали в этом опросе', 'warning');
            return;
        }
        
        // Обновляем статистику
        const option = voting.options.find(o => o.id === optionId);
        if (option) {
            option.votes++;
            voting.totalVotes++;
            
            // Проверяем, не завершилось ли голосование
            const now = new Date();
            const endDate = new Date(voting.endDate);
            if (now > endDate || voting.totalVotes >= voting.minVotes) {
                voting.status = 'finished';
            }
        }
        
        // Регистрируем голос
        authSystem.registerVote(votingId, optionId);
        
        // Обновляем интерфейс
        this.updateStats();
        this.renderVotings();
        
        authSystem.showNotification('Ваш голос учтён!', 'success');
        
        // Сохраняем в localStorage для демо
        this.saveToLocalStorage();
    }
    
    saveToLocalStorage() {
        localStorage.setItem('eco_votings_data', JSON.stringify(this.votings));
    }
    
    updateStats() {
        const active = this.votings.filter(v => v.status === 'active').length;
        const coming = this.votings.filter(v => v.status === 'coming').length;
        const finished = this.votings.filter(v => v.status === 'finished').length;
        const total = this.votings.length;
        
        document.getElementById('votingActive')?.textContent = active;
        document.getElementById('votingComing')?.textContent = coming;
        document.getElementById('votingFinished')?.textContent = finished;
        document.getElementById('votingTotal')?.textContent = total;
    }
    
    // Методы для администратора
    openCreateVotingModal() {
        if (!authSystem.checkPermission('create_voting')) {
            authSystem.showNotification('Только администраторы могут создавать голосования', 'error');
            return;
        }
        
        // Открываем модальное окно из script.js
        if (window.openCreateVotingModal) {
            window.openCreateVotingModal();
        } else {
            authSystem.showNotification('Функция создания голосований в разработке', 'info');
        }
    }
}

// Инициализация системы голосований
let votingSystem;

document.addEventListener('DOMContentLoaded', () => {
    votingSystem = new VotingSystem();
    window.votingSystem = votingSystem;
});
