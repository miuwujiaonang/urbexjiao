// ========== 用户认证模块 ==========

const Auth = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),

    // 检查是否登录
    isLoggedIn() {
        return !!this.token;
    },

    // 获取认证头
    getAuthHeader() {
        return this.token ? { 'Authorization': 'Bearer ' + this.token } : {};
    },

    // 注册
    async register(username, password, email) {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '注册失败');
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    // 登录(普通用户或管理员)
    async login(username, password) {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '登录失败');
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    // 是否管理员
    isAdmin() {
        return this.user && this.user.is_admin === true;
    },

    // 退出
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // 更新顶栏UI
    updateUI() {
        const area = document.getElementById('authArea');
        if (this.isLoggedIn()) {
            const initial = this.user.username.charAt(0).toUpperCase();
            const adminBadge = this.isAdmin() ? '<span class="admin-badge">管理员</span>' : '';
            const avatarStyle = this.isAdmin() ? 'background:#8e44ad;' : '';
            area.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar" style="${avatarStyle}">${initial}</div>
                    <span class="user-name">${this.user.username}</span>
                    ${adminBadge}
                    <button class="btn btn-secondary" onclick="Auth.logout();location.reload()">退出</button>
                </div>
            `;
        } else {
            area.innerHTML = `
                <button class="btn btn-primary" onclick="App.openAuthModal('login')">登录</button>
                <button class="btn btn-accent" onclick="App.openAuthModal('register')">注册</button>
            `;
        }
    }
};
