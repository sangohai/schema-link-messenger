/**
 * @file api/parse.js
 * @description Serverless Proxy for CORS bypass and OpenGraph parsing.
 * @environment Vercel Serverless Function (Node.js runtime)
 */

export default async function handler(req, res) {
    // 1. 设置跨域允许头 (CORS)，允许我们的前端调用
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // 处理预检请求 (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. 获取并校验传入的 URL
    const { url } = req.query;
    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: 'Invalid URL provided.' });
    }

    try {
        console.log(`[Proxy] Fetching HTML from: ${url}`);
        
        // 3. 在服务器端发起请求 (不受浏览器 CORS 限制)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SchemaLinkMessenger/1.0',
            },
            // 设置超时防止目标网站无响应卡死 Serverless 实例
            signal: AbortSignal.timeout(5000) 
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();

        // 4. 原子化提取：纯正则匹配 <title> 和 <meta property="og:image">
        // 提取标题 (Title)
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';
        // 处理部分网站 HTML 实体编码 (如 &#8211;) 的简单替换
        title = title.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

        // 提取预览图 (OpenGraph Image)
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
        
        // 如果没有 og:image，尝试抓取网页里的第一个 img 作为 fallback (兜底)
        const firstImgMatch = html.match(/<img[^>]*src=["'](http[^"']+)["'][^>]*>/i);
        
        let previewImg = '';
        if (ogImageMatch && ogImageMatch[1]) {
            previewImg = ogImageMatch[1];
        } else if (firstImgMatch && firstImgMatch[1]) {
            previewImg = firstImgMatch[1];
        }

        // 5. 返回遵循 Schema.json 契约的数据
        return res.status(200).json({
            title: title,
            preview_img: previewImg
        });

    } catch (error) {
        console.error(`[Proxy Error] Failed to fetch ${url}:`, error.message);
        // 即使解析失败，我们也返回 200，但带有占位符，不让前端崩溃
        return res.status(200).json({
            title: 'Unreachable Link',
            preview_img: '',
            _warning: error.message
        });
    }
}