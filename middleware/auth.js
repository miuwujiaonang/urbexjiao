const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'ruins-explorer-secret-2024-zhangxinyue';

// 必须登录
function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }
    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch (err) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

// 可选登录（不强制，但有token就解析）
function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            req.user = jwt.verify(token, SECRET_KEY);
        } catch (err) {
            // 忽略错误
        }
    }
    next();
}

module.exports = { auth, optionalAuth, SECRET_KEY };
