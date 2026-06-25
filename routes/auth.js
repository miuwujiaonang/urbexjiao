const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth, SECRET_KEY } = require('../middleware/auth');

// 管理员账号(硬编码, 不存数据库)
const ADMIN_USERNAME = 'adurbex0626';
const ADMIN_PASSWORD = '06261228';

// 注册
router.post('/register', async (req, res) => {
    const db = req.app.locals.db;
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度2-20个字符' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: '密码至少6位' });
    }
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }
    }
    if (username === ADMIN_USERNAME) {
        return res.status(400).json({ error: '该用户名不可注册' });
    }

    try {
        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const result = await db.query(
            'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id',
            [username, hash, email || null]
        );
        const userId = result.rows[0].id;

        const token = jwt.sign({ id: userId, username, is_admin: false }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { id: userId, username, email, is_admin: false } });
    } catch (err) {
        console.error('注册错误:', err);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    const db = req.app.locals.db;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 管理员特殊登录
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ id: 0, username: ADMIN_USERNAME, is_admin: true }, SECRET_KEY, { expiresIn: '7d' });
        return res.json({ token, user: { id: 0, username: ADMIN_USERNAME, is_admin: true } });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, is_admin: false }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: false } });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户
router.get('/me', auth, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const result = await db.query('SELECT id, username, email, avatar, created_at FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '用户不存在' });
        res.json({ user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: '查询失败' });
    }
});

module.exports = router;
