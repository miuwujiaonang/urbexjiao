// Netlify Functions 入口
// 把 Express 应用包装成 Netlify Function
const serverless = require('serverless-http');
const app = require('../../server');

// 包装成 serverless 函数
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    // 让 serverless-http 知道这是异步处理
    context.callbackWaitsForEmptyEventLoop = false;
    return handler(event, context);
};
