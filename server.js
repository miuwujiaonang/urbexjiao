const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在(本地开发用, Vercel 上不会用到)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
}

// 初始化 PostgreSQL 连接池
// Vercel 部署时从环境变量读取 DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    // Supabase 推荐配置: 减少连接数, 避免超出免费版限制
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// 静态文件: public 目录(前端)
app.use(express.static(path.join(__dirname, 'public')));
// uploads 目录(本地开发用, Vercel 上图片走 Supabase Storage)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据库挂载到 app
app.locals.db = pool;

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ruins', require('./routes/ruins'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));

// 本地开发模式: 启动服务器 + SPA 回退
// Netlify 部署时不会执行这里(由 netlify/functions/api.js 导出 app)
if (require.main === module) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    app.listen(PORT, () => {
        console.log(`废墟探索服务器已启动: http://localhost:${PORT}`);
        console.log(`提示: 首次运行请先在 Supabase 控制台执行 db/schema.sql`);
    });
}

module.exports = app;
