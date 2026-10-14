import { GoogleGenAI } from '@google/genai';

// 遇到 503 塞車時稍作等待的小函式
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    console.error('❌ 後端錯誤：找不到 GEMINI_API_KEY，請檢查 .env 檔案！');
    return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { question, spreadType, cards } = req.body;

    if (!cards || !cards.length) {
      return res.status(400).json({ error: '請提供抽出的卡牌資料' });
    }

    const cardSummary = cards.map((c, i) => {
      const position = spreadType === 'three' 
        ? ['【過去 / 根源】', '【現在 / 現狀】', '【未來 / 指引】'][i] 
        : '【核心指引】';
      return `${position} 牌名：${c.name}（${c.isReversed ? '逆位' : '正位'}）`;
    }).join('\n');

    const promptText = `
你是一位溫暖、富有洞察力且同理心強的現代塔羅占卜師。
諮詢者的問題：${question ? question : '（無特定提問，請針對整體狀態做全面解讀）'}
使用牌陣：${spreadType === 'three' ? '時間之流三張牌' : '單張核心指引'}

抽牌結果：
${cardSummary}

請依據牌陣與牌意進行深度占卜解讀，包含【牌面洞察】、【核心解答】與【指引建議】。
`;

    // 優先使用 3.8-flash，備援使用不塞車的 3.5-flash-lite
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      // 每個模型最多重試 2 次（應對 503 瞬間尖峰）
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`📡 嘗試呼叫 ${modelName} (第 ${attempt} 次)...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: promptText,
          });

          if (response && response.text) {
            console.log(`✨ 成功由 ${modelName} 產生占卜解讀！`);
            return res.status(200).json({ interpretation: response.text });
          }
        } catch (err) {
          console.warn(`⚠️ ${modelName} 呼叫失敗: ${err.message || err}`);
          lastError = err;
          // 若為 503 塞車，等待 1.5 秒再試
          if (attempt < 2) {
            console.log('⏳ 偵測到塞車，等待 1.5 秒後重試...');
            await sleep(1500);
          }
        }
      }
    }

    throw lastError;

  } catch (error) {
    console.error('❌ 占卜生成失敗：', error);
    return res.status(500).json({ error: '目前官方伺服器用量壅塞，請稍後再試一次。' });
  }
}