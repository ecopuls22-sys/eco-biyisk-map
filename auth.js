// Система авторизации и ролей

const USER_ROLES = {
    GUEST: 'guest',        // Только просмотр
    RESIDENT: 'resident',  // Житель: идеи + голосования
    MONITOR: 'monitor',    // Мониторинг: проблемы
    ADMIN: 'admin'         // Администратор: всё
};

const ROLE_PERMISSIONS = {
    guest: {
        canView: true,
        canAddProblems: false,
        canAddIdeas: false,
        canVote: false,
        canModerate: false,
        canCreateVoting: false,
        maxIdeasPerMonth: 0
    },
    resident: {
        canView: true,
        canAddProblems: false,
        canAddIdeas: true,
        canVote: true,
        canModerate: false,
        canCreateVoting: false,
        maxIdeasPerMonth: 3
    },
    monitor: {
        canView: true,
        canAddProblems: true,
        canAddIdeas: true,
        canVote: true,
        canModerate: false,
        canCreateVoting: false,
        maxIdeasPerMonth: 3
    },
    admin: {
        canView: true,
        canAddProblems: true,
        canAddIdeas: true,
        canVote: true,
        canModerate: true,
        canCreateVoting: true,
        maxIdeasPerMonth: 999
    }
};

class AuthSystem {
    constructor() {
        this.currentRole = USER_ROLES.GUEST;
        this.userId = this.generateUserId();
        this.userIdeas = this.getUserIdeas();
        this.initialize();
    }
    
    initialize() {
        this.loadSavedRole();
        this.setupEventListeners();
        this.updateUI();
    }
    
    generateUserId() {
        // Генерируем уникальный ID пользователя
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
        }
    }
    
    saveRole(role) {
        this.currentRole = role;
        localStorage.setItem('eco_user_role', role);
        this.updateUI();
        this.showNotification(`Режим изменен: ${this.getRoleName(role)}`, 'success');
    }
    
    getRoleName(role) {
        const names = {
            guest: 'Гость',
            resident: 'Житель',
            monitor: 'Народный мониторинг',
            admin: 'Администратор'
        };
        return names[role] || 'Неизвестно';
    }
    
    getPermissions() {
        return ROLE_PERMISSIONS[this.currentRole] || ROLE_PERMISSIONS.guest;
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
                this.saveRole(role);
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
                    this.saveRole(role);
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
        
        // Кнопки в навигации
        const navProblems = document.getElementById('navProblems');
        const navIdeas = document.getElementById('navIdeas');
        const navVoting = document.getElementById('navVoting');
        
        if (navProblems) navProblems.style.display = permissions.canAddProblems ? 'flex' : 'none';
        if (navIdeas) navIdeas.style.display = permissions.canAddIdeas ? 'flex' : 'none';
        if (navVoting) navVoting.style.display = permissions.canVote ? 'flex' : 'none';
        
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
    
    saveUserIdeas() {
        localStorage.setItem(`eco_ideas_${this.userId}`, JSON.stringify(this.userIdeas));
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
    
    getRemainingIdeas() {
        if (!this.getPermissions().canAddIdeas) return 0;
        
        const currentMonth = new Date().getMonth();
        const submittedThisMonth = this.userIdeas.submitted.filter(
            idea => new Date(idea.date).getMonth() === currentMonth
        ).length;
        
        return Math.max(0, this.getPermissions().maxIdeasPerMonth - submittedThisMonth);
    }
    
    registerIdeaSubmission(ideaId) {
        this.userIdeas.submitted.push({
            id: ideaId,
            date: new Date().toISOString()
        });
        this.saveUserIdeas();
        this.updateIdeaLimits();
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
        // Используем общую систему уведомлений
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
            case 'view_problems':
                return permissions.canAddProblems;
            case 'add_problem':
                return permissions.canAddProblems;
            case 'add_idea':
                return this.canSubmitIdea();
            case 'vote':
                return permissions.canVote;
            case 'moderate':
                return permissions.canModerate;
            case 'create_voting':
                return permissions.canCreateVoting;
            default:
                return false;
        }
    }
    
    // Получение информации о пользователе для отправки на сервер
    getUserInfo() {
        return {
            id: this.userId,
            role: this.currentRole,
            roleName: this.getRoleName(this.currentRole),
            remainingIdeas: this.getRemainingIdeas()
        };
    }
}

// Создаем глобальный экземпляр
const authSystem = new AuthSystem();

// Экспортируем для использования в других файлах
window.authSystem = authSystem;
