// Система авторизации и ролей

const USER_ROLES = {
    RESIDENT: 'resident',      // Житель: идеи + голосования
    MONITOR: 'monitor',        // Специалист по благоустройству
    ADMIN: 'admin'             // Администрация
};

const ROLE_PERMISSIONS = {
    resident: {
        // Просмотр
        canView: true,
        canViewObjects: true,
        canViewProblems: true,
        canViewIdeas: true,
        canViewVoting: true,
        
        // Добавление
        canAddObjects: false,      // НЕ может добавлять объекты (деревья, газоны)
        canAddProblems: true,      // Может сообщать о проблемах на объектах
        canAddIdeas: true,         // Может предлагать идеи
        canAddSuggestions: true,   // Может ставить точки с предложениями
        
        // Голосование
        canVote: true,             // Может голосовать
        canCreateVoting: false,    // НЕ может создавать голосования
        
        // Модерация
        canModerate: false,        // НЕ может модерировать
        canDeleteObjects: false,   // НЕ может удалять объекты
        
        // Ограничения
        maxIdeasPerMonth: 3,
        maxProblemsPerDay: 5
    },
    
    monitor: {
        // Просмотр
        canView: true,
        canViewObjects: true,
        canViewProblems: true,
        canViewIdeas: true,
        canViewVoting: true,
        
        // Добавление
        canAddObjects: true,       // Может добавлять объекты (деревья, газоны, кустарники)
        canAddProblems: true,      // Может сообщать о проблемах
        canAddIdeas: true,         // Может предлагать идеи
        canAddSuggestions: true,   // Может ставить точки с предложениями
        
        // Голосование
        canVote: true,
        canCreateVoting: false,    // НЕ может создавать голосования
        
        // Модерация
        canModerate: false,        // Может модерировать только свои объекты
        canDeleteObjects: false,   // НЕ может удалять объекты других
        
        // Ограничения
        maxIdeasPerMonth: 5,
        maxProblemsPerDay: 10
    },
    
    admin: {
        // Просмотр
        canView: true,
        canViewObjects: true,
        canViewProblems: true,
        canViewIdeas: true,
        canViewVoting: true,
        
        // Добавление
        canAddObjects: true,       // Может добавлять объекты
        canAddProblems: true,      // Может сообщать о проблемах
        canAddIdeas: true,         // Может предлагать идеи
        canAddSuggestions: true,   // Может ставить точки с предложениями
        
        // Голосование
        canVote: true,
        canCreateVoting: true,     // Может создавать голосования
        
        // Модерация
        canModerate: true,         // Может модерировать всё
        canDeleteObjects: true,    // Может удалять любые объекты
        canManageUsers: true,      // Может управлять пользователями
        
        // Ограничения
        maxIdeasPerMonth: 999,
        maxProblemsPerDay: 999
    }
};

class AuthSystem {
    constructor() {
        this.currentRole = USER_ROLES.RESIDENT; // По умолчанию "Житель"
        this.userId = this.generateUserId();
        this.userIdeas = this.getUserIdeas();
        this.userProblems = this.getUserProblems();
        this.initialize();
    }
    
    initialize() {
        this.loadSavedRole();
        this.setupEventListeners();
        this.updateUI();
    }
    
    generateUserId() {
        let userId = localStorage.getItem('eco_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('eco_user_id', userId);
        }
        return userId;
    }
    
    loadSavedRole() {
        const savedRole = localStorage.getItem('eco_user_role');
        if (savedRole && USER_ROLES[savedRole.toUpperCase()]) {
            this.currentRole = savedRole;
        } else {
            this.currentRole = USER_ROLES.RESIDENT;
            localStorage.setItem('eco_user_role', this.currentRole);
        }
    }
    
    saveRole(role) {
        if (!USER_ROLES[role.toUpperCase()]) {
            console.error('Неизвестная роль:', role);
            return;
        }
        
        this.currentRole = role;
        localStorage.setItem('eco_user_role', role);
        this.updateUI();
        this.showNotification(`Режим изменен: ${this.getRoleName(role)}`, 'success');
        
        // Перезагружаем данные, которые зависят от роли
        if (window.ideasSystem) window.ideasSystem.renderIdeas();
        if (window.votingSystem) window.votingSystem.renderVotings();
    }
    
    getRoleName(role) {
        const names = {
            resident: 'Житель',
            monitor: 'Специалист',
            admin: 'Администратор'
        };
        return names[role] || 'Житель';
    }
    
    getPermissions() {
        return ROLE_PERMISSIONS[this.currentRole] || ROLE_PERMISSIONS.resident;
    }
    
    setupEventListeners() {
        // Клик по меню пользователя
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('userDropdown');
                dropdown.classList.toggle('show');
            });
        }
        
        // Выбор роли в выпадающем меню
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const role = e.currentTarget.dataset.role;
                if (role !== 'guest') { // Исключаем гостя, если он еще есть в HTML
                    this.saveRole(role);
                }
                document.getElementById('userDropdown').classList.remove('show');
            });
        });
        
        // Закрытие выпадающего меню при клике вне его
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('userDropdown');
            if (dropdown && !e.target.closest('.user-menu')) {
                dropdown.classList.remove('show');
            }
        });
        
        // Открытие модального окна выбора роли
        const roleModal = document.getElementById('roleModal');
        if (roleModal) {
            document.querySelectorAll('.role-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const role = e.currentTarget.dataset.role;
                    if (role !== 'guest') {
                        this.saveRole(role);
                    }
                    this.closeRoleModal();
                });
            });
            
            document.getElementById('closeRoleModal').addEventListener('click', () => {
                this.closeRoleModal();
            });
        }
    }
    
    openRoleModal() {
        document.getElementById('roleModal').style.display = 'flex';
    }
    
    closeRoleModal() {
        document.getElementById('roleModal').style.display = 'none';
    }
    
    updateUI() {
        // Обновляем бейдж роли
        const modeBadge = document.getElementById('currentMode');
        if (modeBadge) {
            modeBadge.textContent = this.getRoleName(this.currentRole);
            modeBadge.setAttribute('data-role', this.currentRole);
        }
        
        // Обновляем имя пользователя
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = this.getRoleName(this.currentRole);
        }
        
        // Показываем/скрываем кнопки в зависимости от роли
        const permissions = this.getPermissions();
        
        // Кнопка добавления объекта (только специалист и админ)
        const addObjectBtn = document.getElementById('addObjectBtn');
        if (addObjectBtn) {
            addObjectBtn.style.display = permissions.canAddObjects ? 'flex' : 'none';
        }
        
        // Кнопка добавления проблемы
        const addProblemBtn = document.getElementById('addProblemBtn');
        if (addProblemBtn) {
            addProblemBtn.style.display = permissions.canAddProblems ? 'flex' : 'none';
        }
        
        // Кнопка добавления идеи
        const addIdeaBtn = document.getElementById('addIdeaBtn');
        if (addIdeaBtn) {
            addIdeaBtn.style.display = permissions.canAddIdeas ? 'flex' : 'none';
        }
        
        // Кнопка создания голосования (только админ)
        const createVotingBtn = document.getElementById('createVotingBtn');
        if (createVotingBtn) {
            createVotingBtn.style.display = permissions.canCreateVoting ? 'flex' : 'none';
        }
        
        // Кнопки в навигации
        const navProblems = document.getElementById('navProblems');
        const navIdeas = document.getElementById('navIdeas');
        const navVoting = document.getElementById('navVoting');
        const navObjects = document.getElementById('navObjects');
        
        if (navProblems) navProblems.style.display = 'flex';
        if (navIdeas) navIdeas.style.display = 'flex';
        if (navVoting) navVoting.style.display = 'flex';
        if (navObjects) navObjects.style.display = 'flex';
        
        // Обновляем лимиты идей
        this.updateIdeaLimits();
    }
    
    getUserIdeas() {
        const ideas = localStorage.getItem(`eco_ideas_${this.userId}`);
        return ideas ? JSON.parse(ideas) : {
            submitted: [],
            votes: {},
            lastReset: new Date().getMonth()
        };
    }
    
    getUserProblems() {
        const problems = localStorage.getItem(`eco_problems_${this.userId}`);
        return problems ? JSON.parse(problems) : {
            submitted: [],
            lastReset: new Date().toDateString()
        };
    }
    
    saveUserIdeas() {
        localStorage.setItem(`eco_ideas_${this.userId}`, JSON.stringify(this.userIdeas));
    }
    
    saveUserProblems() {
        localStorage.setItem(`eco_problems_${this.userId}`, JSON.stringify(this.userProblems));
    }
    
    canSubmitIdea() {
        const permissions = this.getPermissions();
        if (!permissions.canAddIdeas) return false;
        
        // Проверяем, не нужно ли сбросить счетчик
        const currentMonth = new Date().getMonth();
        if (this.userIdeas.lastReset !== currentMonth) {
            this.userIdeas.submitted = [];
            this.userIdeas.lastReset = currentMonth;
            this.saveUserIdeas();
        }
        
        // Проверяем лимит
        const submittedThisMonth = this.userIdeas.submitted.filter(
            idea => new Date(idea.date).getMonth() === currentMonth
        ).length;
        
        return submittedThisMonth < permissions.maxIdeasPerMonth;
    }
    
    canSubmitProblem() {
        const permissions = this.getPermissions();
        if (!permissions.canAddProblems) return false;
        
        // Проверяем, не нужно ли сбросить счетчик
        const today = new Date().toDateString();
        if (this.userProblems.lastReset !== today) {
            this.userProblems.submitted = [];
            this.userProblems.lastReset = today;
            this.saveUserProblems();
        }
        
        // Проверяем лимит
        const submittedToday = this.userProblems.submitted.filter(
            problem => new Date(problem.date).toDateString() === today
        ).length;
        
        return submittedToday < permissions.maxProblemsPerDay;
    }
    
    getRemainingIdeas() {
        if (!this.getPermissions().canAddIdeas) return 0;
        
        const currentMonth = new Date().getMonth();
        const submittedThisMonth = this.userIdeas.submitted.filter(
            idea => new Date(idea.date).getMonth() === currentMonth
        ).length;
        
        return Math.max(0, this.getPermissions().maxIdeasPerMonth - submittedThisMonth);
    }
    
    getRemainingProblems() {
        if (!this.getPermissions().canAddProblems) return 0;
        
        const today = new Date().toDateString();
        const submittedToday = this.userProblems.submitted.filter(
            problem => new Date(problem.date).toDateString() === today
        ).length;
        
        return Math.max(0, this.getPermissions().maxProblemsPerDay - submittedToday);
    }
    
    registerIdeaSubmission(ideaId) {
        this.userIdeas.submitted.push({
            id: ideaId,
            date: new Date().toISOString()
        });
        this.saveUserIdeas();
        this.updateIdeaLimits();
    }
    
    registerProblemSubmission(problemId) {
        this.userProblems.submitted.push({
            id: problemId,
            date: new Date().toISOString()
        });
        this.saveUserProblems();
    }
    
    updateIdeaLimits() {
        const ideasLeft = document.getElementById('ideasLeft');
        if (ideasLeft) {
            ideasLeft.textContent = this.getRemainingIdeas();
        }
        
        const ideaLimits = document.getElementById('ideaLimits');
        if (ideaLimits) {
            ideaLimits.style.display = this.getPermissions().canAddIdeas ? 'block' : 'none';
        }
    }
    
    hasVoted(votingId) {
        return this.userIdeas.votes[votingId] !== undefined;
    }
    
    registerVote(votingId, optionId) {
        this.userIdeas.votes[votingId] = optionId;
        this.saveUserIdeas();
    }
    
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
    
    // Проверка прав для различных действий
    checkPermission(action) {
        const permissions = this.getPermissions();
        
        switch(action) {
            case 'view_objects':
                return permissions.canViewObjects;
            case 'add_object':
                return permissions.canAddObjects;
            case 'view_problems':
                return permissions.canViewProblems;
            case 'add_problem':
                return this.canSubmitProblem();
            case 'add_idea':
                return this.canSubmitIdea();
            case 'vote':
                return permissions.canVote;
            case 'moderate':
                return permissions.canModerate;
            case 'create_voting':
                return permissions.canCreateVoting;
            case 'delete_object':
                return permissions.canDeleteObjects;
            case 'add_suggestion':
                return permissions.canAddSuggestions;
            default:
                return false;
        }
    }
    
    // Получение информации о пользователе
    getUserInfo() {
        return {
            id: this.userId,
            role: this.currentRole,
            roleName: this.getRoleName(this.currentRole),
            remainingIdeas: this.getRemainingIdeas(),
            remainingProblems: this.getRemainingProblems()
        };
    }
}

// Создаем глобальный экземпляр
const authSystem = new AuthSystem();

// Экспортируем для использования в других файлах
window.authSystem = authSystem;
