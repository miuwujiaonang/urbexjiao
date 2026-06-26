const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// 创建评价
router.post('/', auth, async (req, res) => {
    const db = req.app.locals.db;
    const { ruin_id, rating, content } = req.body;

    if (!ruin_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: '废墟ID和评分(1-5)不能为空' });
    }

    try {
        const ruinResult = await db.query('SELECT * FROM ruins WHERE id = $1', [ruin_id]);
        if (ruinResult.rows.length === 0) return res.status(404).json({ error: '废墟不存在' });

        // 允许同一用户多次评价同一废墟
        const result = await db.query(
            'INSERT INTO reviews (ruin_id, user_id, rating, content) VALUES ($1, $2, $3, $4) RETURNING id',
            [ruin_id, req.user.id, rating, content || null]
        );
        res.json({ id: result.rows[0].id, message: '评价成功' });
    } catch (err) {
        console.error('创建评价错误:', err);
        res.status(500).json({ error: '评价失败' });
    }
});

// 删除评价
router.delete('/:id', auth, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const result = await db.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '评价不存在' });
        const review = result.rows[0];
        if (review.user_id !== req.user.id) return res.status(403).json({ error: '无权删除' });

        await db.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除评价错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

module.exports = router;
