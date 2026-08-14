// Dify API 辅助函数
// API_SERVER_URL 可能带或不带 /v1 后缀（及末尾斜杠），统一归一化为 <base>/v1
const baseUrl = () =>
  (process.env.API_SERVER_URL || '').replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
const apiKey = () => process.env.API_KEY;

export const difyUrl = (p) => `${baseUrl()}${p}`;

// 本地用户 id 映射为 Dify 侧稳定用户标识
export const difyUser = (userId) => `user-${userId}`;

// 尽力而为地删除 Dify 侧会话，失败仅记日志
export async function deleteDifyConversation(difyConversationId, user) {
  try {
    const resp = await fetch(difyUrl(`/conversations/${difyConversationId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user }),
    });
    if (!resp.ok) {
      console.warn(`[dify] 删除远端会话失败: ${resp.status} ${await resp.text().catch(() => '')}`);
    }
  } catch (err) {
    console.warn(`[dify] 删除远端会话异常: ${err.message}`);
  }
}
