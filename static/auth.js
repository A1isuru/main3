// Базовый URL API
const API_BASE = 'http://localhost:8000/api';

// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        return JSON.parse(user);
    }
    return null;
}

// Вход
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!username || !password) {
        errorDiv.textContent = 'Заполните все поля';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (!response.ok) {
            const error = await response.json();
            errorDiv.textContent = error.detail || 'Ошибка авторизации';
            return;
        }

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('auth_token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            window.location.href = '/dashboard';
        } else {
            errorDiv.textContent = result.message;
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка соединения';
        console.error('Login error:', error);
    }
}

// Регистрация
async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const errorDiv = document.getElementById('register-error');

    if (!username || !password) {
        errorDiv.textContent = 'Заполните все поля';
        return;
    }

    if (password !== confirm) {
        errorDiv.textContent = 'Пароли не совпадают';
        return;
    }

    if (password.length < 6) {
        errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (!response.ok) {
            const error = await response.json();
            errorDiv.textContent = error.detail || 'Ошибка регистрации';
            return;
        }

        const result = await response.json();

        if (result.success) {
            alert('Регистрация успешна! Теперь войдите.');
            showLogin();
        } else {
            errorDiv.textContent = result.message;
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка соединения';
        console.error('Register error:', error);
    }
}

// Выход
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Показать форму входа
function showLogin() {
    document.getElementById('auth-forms').style.display = 'block';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

// Показать форму регистрации
function showRegister() {
    document.getElementById('auth-forms').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

// Скрыть формы авторизации
function hideAuthForms() {
    document.getElementById('auth-forms').style.display = 'none';
}

// Проверяем авторизацию при загрузке страницы
window.onload = async function() {
    const user = checkAuth();
    const authButtons = document.getElementById('auth-buttons');
    const usernameDisplay = document.getElementById('username-display');

    if (user) {
        if (authButtons) authButtons.style.display = 'none';
        if (usernameDisplay) usernameDisplay.textContent = user.username;
        
        // Если на главной странице и пользователь авторизован
        if (window.location.pathname === '/') {
            window.location.href = '/dashboard';
        }
    } else {
        // Если на защищенных страницах без авторизации
        if (window.location.pathname.includes('/dashboard')) {
            window.location.href = '/';
        }
    }
    
    // Загружаем контент если на главной
    if (window.location.pathname === '/') {
        await loadContent();
    }
};