const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 初始化 PostgreSQL 连接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 数据库初始化(建表 + 管理员占位用户)
async function initDB() {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    // 管理员占位用户(id=0)
    await pool.query(`
        INSERT INTO users (id, username, password_hash, email)
        VALUES (0, 'admin', 'disabled', 'admin@local')
        ON CONFLICT (id) DO NOTHING
    `);
    // 把序列推进到当前最大 id + 1, 避免重新部署时主键冲突
    await pool.query(`
        SELECT setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 0) + 1, false)
    `);
    console.log('数据库初始化完成');
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据库挂载到 app
app.locals.db = pool;

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ruins', require('./routes/ruins'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));

// 所有其他路由返回首页
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`废墟探索服务器已启动: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
});

module.exports = app;
