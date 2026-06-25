// Vercel Serverless Function 入口
// 把整个 Express 应用导出给 Vercel 使用
const app = require('../server');
module.exports = app;
