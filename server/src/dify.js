// Dify API 辅助函数
// API_SERVER_URL 可能带或不带 /v1 后缀（及末尾斜杠），统一归一化为 <base>/v1
const baseUrl = () =>
  (process.env.API_SERVER_URL || '').replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';

export const difyUrl = (p) => `${baseUrl()}${p}`;

// 本地用户 id 映射为 Dify 侧稳定用户标识
export const difyUser = (userId) => `user-${userId}`;
