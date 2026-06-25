// ========== 一键恢复脚本 ==========
// 从 backup-YYYY-MM-DD-HHmmss 目录恢复数据到云端 PostgreSQL
//
// 用法(在废墟探索文件夹下运行):
//   1. 设置环境变量 DATABASE_URL (从 Supabase 控制台 → Project Settings → Database → Connection string 复制)
//      Windows PowerShell: $env:DATABASE_URL="postgresql://user:pass@host/db"
//      Windows cmd:        set DATABASE_URL=postgresql://user:pass@host/db
//   2. 运行:
//      node restore.js                                # 自动找最新的 backup-* 目录
//      node restore.js backup-2026-06-26T08-30-15    # 指定备份目录
//      node restore.js backup-xxx --skip-images       # 只恢复数据库, 不上传图片
//
// 前置条件: 先运行 npm install 安装 pg 依赖
// 需要管理员账号: adurbex0626 / 06261228

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ====== 配置区(可改) ======
// 把下面这行的域名改成你 Netlify 部署完成后拿到的实际域名
const SITE_URL = process.env.SITE_URL || 'https://urbexjiao.netlify.app';
const ADMIN_USER = 'adurbex0626';
const ADMIN_PASS = '06261228';
// ===========================

// 找最新的 backup-* 目录
function findLatestBackup() {
    const entries = fs.readdirSync(__dirname);
    const backups = entries
        .filter(name => name.startsWith('backup-') && fs.statSync(path.join(__dirname, name)).isDirectory())
        .sort()
        .reverse();
    return backups[0] || null;
}

// 通用 HTTP 请求
function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.request(url, options, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({ status: res.statusCode, body: body.toString('utf8') });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

// 流式上传文件
function uploadFile(url, filePath, token) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const stat = fs.statSync(filePath);
        const req = lib.request(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream',
                'Content-Length': stat.size
            }
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
            });
        });
        req.on('error', reject);
        fs.createReadStream(filePath).pipe(req);
    });
}

// SQL 值转义
function sqlVal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    // 字符串, 转义单引号
    return "'" + String(v).replace(/'/g, "''") + "'";
}

async function main() {
    // 0. 参数解析
    const args = process.argv.slice(2);
    const skipImages = args.includes('--skip-images');
    const positional = args.filter(a => !a.startsWith('--'));
    const backupName = positional[0] || findLatestBackup();

    if (!backupName) {
        console.error('未找到备份目录! 请先运行 node backup.js');
        process.exit(1);
    }
    const backupDir = path.isAbsolute(backupName) ? backupName : path.join(__dirname, backupName);
    if (!fs.existsSync(backupDir)) {
        console.error(`备份目录不存在: ${backupDir}`);
        process.exit(1);
    }
    const dataFile = path.join(backupDir, 'data.json');
    if (!fs.existsSync(dataFile)) {
        console.error(`备份目录里没有 data.json: ${backupDir}`);
        process.exit(1);
    }

    // 1. 加载 pg 模块
    let Pool;
    try {
        ({ Pool } = require('pg'));
    } catch (e) {
        console.error('未安装 pg 模块, 请先运行: npm install');
        process.exit(1);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('未设置 DATABASE_URL 环境变量!');
        console.error('请到 Render 控制台 → PostgreSQL → Connections → External Database URL 复制, 然后:');
        console.error('  Windows PowerShell: $env:DATABASE_URL="复制的连接串"');
        console.error('  Windows cmd:        set DATABASE_URL=复制的连接串');
        process.exit(1);
    }

    console.log(`\n=== 废墟探索 - 一键恢复 ===`);
    console.log(`备份目录: ${backupDir}`);

    // 2. 读取备份
    const backup = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log(`备份时间: ${backup.exported_at}`);
    console.log(`备份内容: 用户 ${backup.counts.users}  废墟 ${backup.counts.ruins}  图片 ${backup.counts.images}  评价 ${backup.counts.reviews}\n`);

    // 3. 连接 PostgreSQL
    console.log('[1/3] 连接 PostgreSQL...');
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 4. 清空旧数据(按外键反向顺序, 保留 id=0 的 admin 占位用户)
        console.log('[2/3] 清空旧数据 + 写入备份数据...');
        await pool.query('BEGIN');
        await pool.query('DELETE FROM reviews');
        await pool.query('DELETE FROM images');
        await pool.query('DELETE FROM ruins');
        await pool.query('DELETE FROM users WHERE id != 0');

        // 4.1 插入 users (跳过 id=0 的 admin 占位, 避免冲突)
        for (const u of backup.data.users) {
            if (u.id === 0) continue;  // admin 占位用户已存在
            await pool.query(`
                INSERT INTO users (id, username, password_hash, email, avatar, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [u.id, u.username, u.password_hash || 'disabled', u.email || null, u.avatar || null, u.created_at]);
        }

        // 4.2 插入 ruins
        for (const r of backup.data.ruins) {
            await pool.query(`
                INSERT INTO ruins (id, user_id, name, category, longitude, latitude, description,
                    has_security, has_dogs, difficulty, route, is_sensitive, is_public,
                    country, province, city, district, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
            `, [r.id, r.user_id, r.name, r.category, r.longitude, r.latitude, r.description,
                r.has_security, r.has_dogs, r.difficulty, r.route, r.is_sensitive, r.is_public,
                r.country, r.province, r.city, r.district, r.created_at, r.updated_at]);
        }

        // 4.3 插入 images
        // 把相对路径 /uploads/xxx 转成绝对 URL, 让 Netlify 前端能跨域加载
        const baseUrl = SITE_URL.replace(/\/+$/, '');
        for (const im of backup.data.images) {
            let filePath = im.file_path;
            if (filePath && filePath.startsWith('/')) {
                filePath = baseUrl + filePath;
            }
            await pool.query(`
                INSERT INTO images (id, ruin_id, user_id, file_path, description, uploaded_at)
                VALUES ($1,$2,$3,$4,$5,$6)
            `, [im.id, im.ruin_id, im.user_id, filePath, im.description, im.uploaded_at]);
        }

        // 4.4 插入 reviews
        for (const rv of backup.data.reviews) {
            await pool.query(`
                INSERT INTO reviews (id, ruin_id, user_id, rating, content, created_at)
                VALUES ($1,$2,$3,$4,$5,$6)
            `, [rv.id, rv.ruin_id, rv.user_id, rv.rating, rv.content, rv.created_at]);
        }

        // 4.5 重置所有序列到 MAX(id)+1
        for (const table of ['users', 'ruins', 'images', 'reviews']) {
            await pool.query(`
                SELECT setval('${table}_id_seq',
                    GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 0) + 1,
                    false)
            `);
        }

        await pool.query('COMMIT');
        console.log(`    数据库恢复完成\n`);

        // 5. 上传图片(可选)
        if (skipImages) {
            console.log('[3/3] 跳过图片上传 (--skip-images)\n');
        } else {
            console.log('[3/3] 上传图片到 Render...');
            const uploadsDir = path.join(backupDir, 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                console.log('    备份目录里没有 uploads 子目录, 跳过\n');
            } else {
                // 登录
                const baseUrl = SITE_URL.replace(/\/+$/, '');
                const loginRes = await httpRequest(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
                });
                if (loginRes.status !== 200) {
                    console.error('    管理员登录失败, 图片未上传:', loginRes.body);
                } else {
                    const { token } = JSON.parse(loginRes.body);
                    const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));
                    let ok = 0, fail = 0;
                    for (const file of files) {
                        try {
                            const res = await uploadFile(
                                `${baseUrl}/api/admin/restore-image?filename=${encodeURIComponent(file)}`,
                                path.join(uploadsDir, file),
                                token
                            );
                            if (res.status === 200) ok++;
                            else { fail++; console.error(`    [失败] ${file}: ${res.body}`); }
                        } catch (e) {
                            fail++;
                            console.error(`    [失败] ${file}: ${e.message}`);
                        }
                    }
                    console.log(`    成功: ${ok}  失败: ${fail}\n`);
                }
            }
        }

        console.log(`=== 恢复完成 ===`);
        console.log(`数据库已写入: 用户 ${backup.counts.users}  废墟 ${backup.counts.ruins}  图片 ${backup.counts.images}  评价 ${backup.counts.reviews}`);
        console.log(`现在访问网站应该能看到所有恢复的数据了\n`);
    } catch (err) {
        console.error('\n恢复出错:', err.message);
        try { await pool.query('ROLLBACK'); } catch (e) {}
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error('\n恢复出错:', err);
    process.exit(1);
});
