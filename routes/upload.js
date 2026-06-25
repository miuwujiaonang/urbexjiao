const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');

// 使用内存存储(Vercel 没有持久文件系统, 必须用 memoryStorage)
// 然后上传到 Supabase Storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 jpg/jpeg/png/gif/webp 格式'));
        }
    }
});

// 懒加载 Supabase 客户端(只在需要时创建)
let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY  // service_role key, 可绕过 RLS
    );
    return supabaseClient;
}

// 图片上传
// Vercel 部署: 上传到 Supabase Storage
// 本地开发(无 SUPABASE_URL): 存到本地 uploads 目录
router.post('/', auth, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;

    // 如果配置了 Supabase, 上传到 Supabase Storage
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.storage
                .from('ruins-images')
                .upload(filename, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });
            if (error) throw error;

            // 获取公开访问 URL
            const { data: urlData } = supabase.storage
                .from('ruins-images')
                .getPublicUrl(filename);

            return res.json({ path: urlData.publicUrl });
        } catch (err) {
            console.error('Supabase 上传错误:', err);
            return res.status(500).json({ error: '图片上传失败: ' + err.message });
        }
    }

    // 本地开发模式: 存到 uploads 目录
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ path: `${baseUrl}/uploads/${filename}` });
});

module.exports = router;
