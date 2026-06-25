// ========== 一键备份脚本 ==========
// 用法(在废墟探索文件夹下运行):
//   node backup.js                              # 用下面的默认域名
//   node backup.js https://你的-netlify-域名.netlify.app   # 命令行传参
//
// 备份结果:
//   backup-YYYY-MM-DD-HHmmss/
//     ├── data.json      (所有数据库内容: 用户/废墟/图片/评价)
//     └── uploads/       (所有图片文件)
//
// 需要管理员账号: adurbex0626 / 06261228

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ====== 配置区(可改) ======
// 把下面这行的域名改成你 Netlify 部署完成后拿到的实际域名
const SITE_URL = process.argv[2] || 'https://urbexjiao.netlify.app';
const ADMIN_USER = 'adurbex0626';
const ADMIN_PASS = '06261228';
// ===========================

// 通用请求函数
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body, headers: res.headers });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

// 下载二进制文件
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        lib.get(url, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

async function main() {
    const baseUrl = SITE_URL.replace(/\/+$/, '');  // 去掉末尾斜杠
    console.log(`\n=== 废墟探索 - 一键备份 ===`);
    console.log(`网站地址: ${baseUrl}\n`);

    // 1. 登录获取 token
    console.log('[1/4] 登录管理员账号...');
    const loginRes = await request(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    if (loginRes.status !== 200) {
        console.error('登录失败:', loginRes.body);
        process.exit(1);
    }
    const { token } = JSON.parse(loginRes.body);
    console.log('    登录成功\n');

    // 2. 调用备份接口
    console.log('[2/4] 拉取数据库内容...');
    const backupRes = await request(`${baseUrl}/api/admin/backup`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    if (backupRes.status !== 200) {
        console.error('备份接口失败:', backupRes.body);
        process.exit(1);
    }
    const backup = JSON.parse(backupRes.body);
    console.log(`    用户: ${backup.counts.users}  废墟: ${backup.counts.ruins}  图片: ${backup.counts.images}  评价: ${backup.counts.reviews}\n`);

    // 3. 创建备份目录
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = path.join(__dirname, `backup-${ts}`);
    const uploadsDir = path.join(dir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // 4. 下载所有图片
    console.log('[3/4] 下载图片...');
    let okCount = 0, failCount = 0;
    for (const img of backup.data.images) {
        let url = img.file_path;
        // 如果是相对路径(/uploads/xxx), 拼上后端域名
        if (url.startsWith('/')) url = baseUrl + url;
        // 从 URL 提取文件名
        const filename = path.basename(url.split('?')[0]);
        const dest = path.join(uploadsDir, filename);
        try {
            await downloadFile(url, dest);
            okCount++;
        } catch (err) {
            console.error(`    [失败] ${filename}: ${err.message}`);
            failCount++;
        }
        // 同时把 file_path 改成本地路径, 方便后续恢复
        img.file_path = `/uploads/${filename}`;
    }
    console.log(`    成功: ${okCount}  失败: ${failCount}\n`);

    // 5. 保存 JSON
    console.log('[4/4] 保存 data.json...');
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(backup, null, 2), 'utf8');

    console.log(`\n=== 备份完成 ===`);
    console.log(`备份目录: ${dir}`);
    console.log(`  - data.json       (数据库内容)`);
    console.log(`  - uploads/        (${okCount}张图片)\n`);
}

main().catch(err => {
    console.error('\n备份出错:', err);
    process.exit(1);
});
