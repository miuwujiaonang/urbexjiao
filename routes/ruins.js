const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// 三态解析: 0=无, 1=有, 2=不确定
function triState(v) {
    const n = parseInt(v);
    if (n === 0 || n === 1) return n;
    return 2;
}

// 获取废墟列表（带筛选）
router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { category, country, province, city, district, has_security, has_dogs, difficulty, search } = req.query;

    let query = `
        SELECT r.*, u.username as author,
               (SELECT file_path FROM images WHERE ruin_id = r.id ORDER BY uploaded_at DESC LIMIT 1) as cover_image,
               (SELECT AVG(rating) FROM reviews WHERE ruin_id = r.id) as avg_rating,
               (SELECT COUNT(*) FROM reviews WHERE ruin_id = r.id) as review_count
        FROM ruins r
        JOIN users u ON r.user_id = u.id
        WHERE r.is_public = 1
    `;

    const params = [];
    let idx = 1;
    if (category) { query += ` AND r.category = $${idx++}`; params.push(category); }
    if (country) { query += ` AND r.country LIKE $${idx++}`; params.push(`%${country}%`); }
    if (province) { query += ` AND r.province LIKE $${idx++}`; params.push(`%${province}%`); }
    if (city) { query += ` AND r.city LIKE $${idx++}`; params.push(`%${city}%`); }
    if (district) { query += ` AND r.district LIKE $${idx++}`; params.push(`%${district}%`); }
    if (has_security !== undefined && has_security !== '') { query += ` AND r.has_security = $${idx++}`; params.push(parseInt(has_security)); }
    if (has_dogs !== undefined && has_dogs !== '') { query += ` AND r.has_dogs = $${idx++}`; params.push(parseInt(has_dogs)); }
    if (difficulty) { query += ` AND r.difficulty = $${idx++}`; params.push(parseInt(difficulty)); }
    if (search) { query += ` AND (r.name LIKE $${idx} OR r.description LIKE $${idx++})`; params.push(`%${search}%`); }

    query += ' ORDER BY r.created_at DESC';
    try {
        const result = await db.query(query, params);
        res.json({ ruins: result.rows });
    } catch (err) {
        console.error('查询废墟列表错误:', err);
        res.status(500).json({ error: '查询失败' });
    }
});

// 获取单个废墟详情
router.get('/:id', async (req, res) => {
    const db = req.app.locals.db;
    try {
        const result = await db.query(`
            SELECT r.*, u.username as author,
                   (SELECT AVG(rating) FROM reviews WHERE ruin_id = r.id) as avg_rating,
                   (SELECT COUNT(*) FROM reviews WHERE ruin_id = r.id) as review_count
            FROM ruins r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: '废墟不存在' });
        const ruin = result.rows[0];

        const imgResult = await db.query(`
            SELECT im.*, u.username FROM images im JOIN users u ON im.user_id = u.id WHERE im.ruin_id = $1 ORDER BY im.uploaded_at DESC
        `, [req.params.id]);
        ruin.images = imgResult.rows;

        res.json({ ruin });
    } catch (err) {
        console.error('查询废墟详情错误:', err);
        res.status(500).json({ error: '查询失败' });
    }
});

// 创建废墟
router.post('/', auth, async (req, res) => {
    const db = req.app.locals.db;
    const { name, category, longitude, latitude, description, has_security, has_dogs, difficulty, route, is_sensitive, is_public, country, province, city, district, external_link } = req.body;

    if (!name || !category || longitude === undefined || latitude === undefined) {
        return res.status(400).json({ error: '名称、类别和经纬度不能为空' });
    }

    try {
        const result = await db.query(`
            INSERT INTO ruins (user_id, name, category, longitude, latitude, description, has_security, has_dogs, difficulty, route, is_sensitive, is_public, country, province, city, district, external_link)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
        `, [req.user.id, name, category, longitude, latitude, description || null,
            triState(has_security), triState(has_dogs), difficulty || 1, route || null,
            triState(is_sensitive), is_public !== false ? 1 : 0,
            country || null, province || null, city || null, district || null,
            external_link || null]);

        res.json({ id: result.rows[0].id, message: '废墟创建成功' });
    } catch (err) {
        console.error('创建废墟错误:', err);
        res.status(500).json({ error: '创建失败' });
    }
});

// 更新废墟
router.put('/:id', auth, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const ruinResult = await db.query('SELECT * FROM ruins WHERE id = $1', [req.params.id]);
        if (ruinResult.rows.length === 0) return res.status(404).json({ error: '废墟不存在' });
        const ruin = ruinResult.rows[0];
        if (!req.user.is_admin && ruin.user_id !== req.user.id) return res.status(403).json({ error: '无权修改' });

        const { name, category, longitude, latitude, description, has_security, has_dogs, difficulty, route, is_sensitive, is_public, country, province, city, district, external_link } = req.body;

        await db.query(`
            UPDATE ruins SET
                name = $1, category = $2, longitude = $3, latitude = $4, description = $5,
                has_security = $6, has_dogs = $7, difficulty = $8, route = $9, is_sensitive = $10,
                is_public = $11, country = $12, province = $13, city = $14, district = $15,
                external_link = $16,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $17
        `, [name || ruin.name, category || ruin.category,
            longitude !== undefined ? longitude : ruin.longitude,
            latitude !== undefined ? latitude : ruin.latitude,
            description !== undefined ? description : ruin.description,
            triState(has_security), triState(has_dogs), difficulty || ruin.difficulty,
            route !== undefined ? route : ruin.route, triState(is_sensitive),
            is_public !== undefined ? (is_public ? 1 : 0) : ruin.is_public,
            country !== undefined ? country : ruin.country,
            province !== undefined ? province : ruin.province,
            city !== undefined ? city : ruin.city,
            district !== undefined ? district : ruin.district,
            external_link !== undefined ? (external_link || null) : ruin.external_link,
            req.params.id]);

        res.json({ message: '更新成功' });
    } catch (err) {
        console.error('更新废墟错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 删除废墟
router.delete('/:id', auth, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const ruinResult = await db.query('SELECT * FROM ruins WHERE id = $1', [req.params.id]);
        if (ruinResult.rows.length === 0) return res.status(404).json({ error: '废墟不存在' });
        const ruin = ruinResult.rows[0];
        if (!req.user.is_admin && ruin.user_id !== req.user.id) return res.status(403).json({ error: '无权删除' });

        await db.query('DELETE FROM ruins WHERE id = $1', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除废墟错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 给废墟添加图片
router.post('/:id/images', auth, async (req, res) => {
    const db = req.app.locals.db;
    const { file_path, description } = req.body;

    try {
        const ruinResult = await db.query('SELECT * FROM ruins WHERE id = $1', [req.params.id]);
        if (ruinResult.rows.length === 0) return res.status(404).json({ error: '废墟不存在' });

        const result = await db.query(
            'INSERT INTO images (ruin_id, user_id, file_path, description) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.params.id, req.user.id, file_path, description || null]
        );
        res.json({ id: result.rows[0].id, message: '图片添加成功' });
    } catch (err) {
        console.error('添加图片错误:', err);
        res.status(500).json({ error: '添加失败' });
    }
});

// 获取废墟的评价
router.get('/:id/reviews', async (req, res) => {
    const db = req.app.locals.db;
    try {
        const result = await db.query(`
            SELECT rv.*, u.username, u.avatar
            FROM reviews rv
            JOIN users u ON rv.user_id = u.id
            WHERE rv.ruin_id = $1
            ORDER BY rv.created_at DESC
        `, [req.params.id]);
        res.json({ reviews: result.rows });
    } catch (err) {
        console.error('查询评价错误:', err);
        res.status(500).json({ error: '查询失败' });
    }
});

module.exports = router;
