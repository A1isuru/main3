// script.js

const API_BASE = 'http://localhost:8000/api';

// Функции для работы с localStorage
function saveAuthData(sessionId, user) {
    localStorage.setItem('session_id', sessionId);
    localStorage.setItem('user', JSON.stringify(user));
}

function clearAuthData() {
    localStorage.removeItem('session_id');
    localStorage.removeItem('user');
}

function isLoggedIn() {
    return localStorage.getItem('session_id') !== null;
}

function getSessionId() {
    return localStorage.getItem('session_id');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Функция регистрации
async function register(username, password) {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, message: data.message };
        } else {
            const error = await response.json();
            return { success: false, message: error.detail || 'Ошибка регистрации' };
        }
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, message: 'Ошибка соединения с сервером' };
    }
}

// Функция входа
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            saveAuthData(data.session_id, data.user);
            return { success: true, message: 'Вход успешен' };
        } else {
            const error = await response.json();
            return { success: false, message: error.detail || 'Ошибка входа' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Ошибка соединения с сервером' };
    }
}

// Функция выхода
function logout() {
    clearAuthData();
    window.location.href = '/';
}

// Загрузка контента для главной страницы
async function loadContent() {
    try {
        const response = await fetch(`${API_BASE}/content`);
        if (!response.ok) throw new Error('Ошибка загрузки контента');
        
        const content = await response.json();
        
        const container = document.getElementById('content');
        if (container) {
            container.innerHTML = '';
            
            if (content.length === 0) {
                container.innerHTML = '<p>Пока нет статей</p>';
                return;
            }
            
            content.forEach(item => {
                const div = document.createElement('div');
                div.className = 'content-item';
                div.innerHTML = `
                    <h3>${item.title}</h3>
                    <p>${item.content.substring(0, 200)}...</p>
                    <small>Автор: ${item.author} | Дата: ${new Date(item.date).toLocaleDateString()}</small>
                `;
                container.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки контента:', error);
        const container = document.getElementById('content');
        if (container) {
            container.innerHTML = '<p>Ошибка загрузки статей</p>';
        }
    }
}

// Загрузка списка контента для dashboard
async function loadContentList() {
    if (!isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    const user = getUser();
    if (!user) {
        window.location.href = '/';
        return;
    }

    try {
        const sessionId = getSessionId();
        const response = await fetch(`${API_BASE}/content?user_id=${user.id}`, {
            headers: {
                'X-Session-ID': sessionId  // ИСПРАВЛЕНО: был Authorization: Bearer
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('Ошибка загрузки контента');
        }
        
        const content = await response.json();
        
        const container = document.getElementById('dashboard-content');
        if (!container) return;
        
        container.innerHTML = '<h2>Мои статьи</h2>';
        
        const list = document.createElement('div');
        list.id = 'content-list';
        
        if (content.length === 0) {
            list.innerHTML = '<p>У вас еще нет статей</p>';
        } else {
            content.forEach(item => {
                const div = document.createElement('div');
                div.className = 'content-item';
                div.innerHTML = `
                    <h3>${item.title}</h3>
                    <p>${item.content.substring(0, 150)}...</p>
                    <small>Дата: ${new Date(item.date).toLocaleDateString()}</small>
                    <div>
                        <button onclick="deleteContent('${item.id}')">Удалить</button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
        
        container.appendChild(list);
    } catch (error) {
        console.error('Ошибка загрузки списка:', error);
        alert('Ошибка загрузки статей');
    }
}

// Показать форму добавления
function showAddForm() {
    if (!isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    const container = document.getElementById('dashboard-content');
    if (!container) return;
    
    container.innerHTML = `
        <h2>Добавить статью</h2>
        <div class="editor">
            <input type="text" id="content-title" placeholder="Заголовок">
            <textarea id="content-body" placeholder="Содержание"></textarea>
            <button onclick="saveContent()">Сохранить</button>
            <button onclick="loadContentList()">Отмена</button>
        </div>
    `;
}

// Сохранение контента
async function saveContent() {
    if (!isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    const user = getUser();
    const sessionId = getSessionId();
    const title = document.getElementById('content-title')?.value;
    const content = document.getElementById('content-body')?.value;

    if (!title || !content) {
        alert('Заполните все поля');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId  // ИСПРАВЛЕНО: был Authorization
            },
            body: JSON.stringify({
                title: title,
                content: content,
                author: user.username,
                user_id: user.id
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка сохранения');
        }

        const result = await response.json();
        
        if (result.success) {
            alert('Статья сохранена!');
            loadContentList();
        } else {
            alert('Ошибка: ' + result.message);
        }
    } catch (error) {
        alert('Ошибка сохранения: ' + error.message);
    }
}

// Удаление контента
async function deleteContent(id) {
    if (!confirm('Удалить статью?')) return;
    
    if (!isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    try {
        const sessionId = getSessionId();
        const response = await fetch(`${API_BASE}/content/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Session-ID': sessionId  // ИСПРАВЛЕНО: был Authorization
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка удаления');
        }

        const result = await response.json();
        
        if (result.success) {
            alert('Статья удалена!');
            loadContentList();
        }
    } catch (error) {
        alert('Ошибка удаления: ' + error.message);
    }
}

// Показать профиль
async function showProfile() {
    if (!isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    const user = getUser();
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    
    container.innerHTML = `
        <h2>Профиль</h2>
        <div class="profile">
            <p><strong>Имя пользователя:</strong> ${user.username}</p>
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Дата регистрации:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
            <button onclick="logout()">Выйти</button>
        </div>
    `;
}

// Обработчики для форм
function initAuthForms() {
    // Обработчик формы входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            const result = await login(username, password);
            if (result.success) {
                window.location.href = '/dashboard';
            } else {
                alert(result.message);
            }
        });
    }
    
    // Обработчик формы регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            
            const result = await register(username, password);
            alert(result.message);
            
            if (result.success) {
                // После успешной регистрации можно сразу войти
                const loginResult = await login(username, password);
                if (loginResult.success) {
                    window.location.href = '/dashboard';
                }
            }
        });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initAuthForms();
    
    // Для главной страницы
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        loadContent();
        
        // Показываем/скрываем элементы в зависимости от авторизации
        updateAuthUI();
    }
    
    // Для dashboard
    if (window.location.pathname.includes('/dashboard')) {
        if (!isLoggedIn()) {
            window.location.href = '/';
            return;
        }
        
        // Показываем имя пользователя
        const user = getUser();
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.textContent = user.username;
        }
        
        // Загружаем контент
        loadContentList();
    }
});

// Обновление UI в зависимости от авторизации
function updateAuthUI() {
    const user = getUser();
    const authSection = document.getElementById('auth-section');
    
    if (authSection) {
        if (user) {
            authSection.innerHTML = `
                <p>Вы вошли как: ${user.username}</p>
                <button onclick="window.location.href='/dashboard'">Личный кабинет</button>
                <button onclick="logout()">Выйти</button>
            `;
        } else {
            authSection.innerHTML = `
                <button onclick="showLoginForm()">Войти</button>
                <button onclick="showRegisterForm()">Регистрация</button>
            `;
        }
    }
}

// Функции для показа форм (если нужно)
function showLoginForm() {
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('register-form-container').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('register-form-container').style.display = 'block';
    document.getElementById('login-form-container').style.display = 'none';
}