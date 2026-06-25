const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');

// 管理员专用: 必须是 admin 才能访问
function adminOnly(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: '仅管理员可访问' });
    }
    next();
}

// 一键导出全部数据(users/ruins/images/reviews)
// GET /api/admin/backup
router.get('/backup', auth, adminOnly, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const [users, ruins, images, reviews] = await Promise.all([
            db.query('SELECT id, username, password_hash, email, avatar, created_at FROM users ORDER BY id'),
            db.query('SELECT * FROM ruins ORDER BY id'),
            db.query('SELECT * FROM images ORDER BY id'),
            db.query('SELECT * FROM reviews ORDER BY id')
        ]);
        res.json({
            exported_at: new Date().toISOString(),
            counts: {
                users: users.rows.length,
                ruins: ruins.rows.length,
                images: images.rows.length,
                reviews: reviews.rows.length
            },
            data: {
                users: users.rows,
                ruins: ruins.rows,
                images: images.rows,
                reviews: reviews.rows
            }
        });
    } catch (err) {
        console.error('备份错误:', err);
        res.status(500).json({ error: '备份失败: ' + err.message });
    }
});

// 管理员恢复图片: 保持原文件名上传到 uploads/
// POST /api/admin/restore-image?filename=xxx.jpg
// body: 图片二进制内容
router.post('/restore-image', auth, adminOnly, (req, res) => {
    const filename = req.query.filename;
    if (!filename || !/^[\w\-]+\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
        return res.status(400).json({ error: '文件名不合法' });
    }
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const dest = path.join(uploadsDir, filename);

    // 流式写入
    const stream = fs.createWriteStream(dest);
    req.pipe(stream);
    stream.on('finish', () => res.json({ message: '图片恢复成功', filename }));
    stream.on('error', (err) => res.status(500).json({ error: '写入失败: ' + err.message }));
});

module.exports = router;
