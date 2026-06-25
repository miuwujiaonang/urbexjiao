-- ==========================================
-- 废墟探索 - 数据库建表脚本
-- 在 Supabase 控制台 → SQL Editor 里执行一次即可
-- ==========================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 废墟表
CREATE TABLE IF NOT EXISTS ruins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    description TEXT,
    has_security INTEGER DEFAULT 0,
    has_dogs INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 1 CHECK(difficulty >= 1 AND difficulty <= 5),
    route TEXT,
    is_sensitive INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1,
    country TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 图片表
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    ruin_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ruin_id) REFERENCES ruins(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    ruin_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ruin_id) REFERENCES ruins(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ruins_location ON ruins(longitude, latitude);
CREATE INDEX IF NOT EXISTS idx_ruins_category ON ruins(category);
CREATE INDEX IF NOT EXISTS idx_ruins_public ON ruins(is_public);
CREATE INDEX IF NOT EXISTS idx_images_ruin ON images(ruin_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ruin ON reviews(ruin_id);

-- ==========================================
-- 管理员占位用户(id=0)
-- 管理员账号 adurbex0626/06261228 是硬编码在代码里的, 不存数据库
-- 但废墟的 user_id 可能是 0, 所以需要一个 id=0 的占位用户避免外键冲突
-- ==========================================
INSERT INTO users (id, username, password_hash, email)
VALUES (0, 'admin', 'disabled', 'admin@local')
ON CONFLICT (id) DO NOTHING;

-- 把 users 的自增序列设为 MAX(id)+1, 避免下次注册主键冲突
SELECT setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 0) + 1, false);
