// =====================
// monitor.js (一覧監視・高精度版)
// =====================

import fs from "fs";
import { execSync } from "child_process";

// =====================
// 設定
// =====================

const TARGET_URL = "https://l-tike.com/concert/mevent/?mid=366800";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const DATA_FILE = "ticket_list_data.txt";

// =====================
// 日本時間取得
// =====================

function nowJP() {
    return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================
// Git処理
// =====================

function pullLatest() {
    try {
        const branch = process.env.GITHUB_REF_NAME || "main";
        execSync("git config user.name 'github-actions[bot]'");
        execSync("git config user.email 'github-actions[bot]@users.noreply.github.com'");
        execSync(`git fetch origin ${branch}`);
        execSync(`git checkout ${branch}`);
        execSync(`git pull origin ${branch} --rebase`);
        console.log("リポジトリ最新化完了");
    } catch (e) {
        console.log("Git Pullスキップまたは失敗:", e.message);
    }
}

function commitAndPush(commitMessage) {
    try {
        const branch = process.env.GITHUB_REF_NAME || "main";
        if (fs.existsSync(DATA_FILE)) {
            execSync(`git add ${DATA_FILE}`);
        }

        try {
            execSync(`git commit -m "${commitMessage}"`);
            execSync(`git push origin ${branch}`);
            console.log("GitHubへ即時保存完了");
        } catch (e) {
            console.log("Gitコミット対象なし、または書き込み不要");
        }
    } catch (e) {
        console.error("Git Push失敗:", e.message);
    }
}

// =====================
// HTML取得
// =====================

async function fetchHTML(url) {
    for (let i = 1; i <= 3; i++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => { controller.abort(); }, 30000);
            
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "ja-JP,ja;q=0.9",
                    "Cache-Control": "no-cache"
                },
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) {
            if (i === 3) throw e;
            await sleep(i === 1 ? 3000 : 6000);
        }
    }
}

// =====================
// 解析処理（漏れなく全体を取得）
// =====================

const S = String.fromCharCode(42);

function extractPageContent(html) {
    // script/style/commentを削除
    const scriptRegex = new RegExp("<script[\\s\\S]" + S + "?</script>", "gi");
    const styleRegex = new RegExp("<style[\\s\\S]" + S + "?</style>", "gi");
    const commentRegex = new RegExp("<!--[\\s\\S]" + S + "?-->", "gi");

    let cleaned = html
        .replace(scriptRegex, "")
        .replace(styleRegex, "")
        .replace(commentRegex, "");

    // メインのコンテンツ領域（なければbody）を抽出
    let mainMatch = cleaned.match(/<main[\\s\\S]*?<\/main>/i) || cleaned.match(/<body[\\s\\S]*?<\/body>/i);
    let targetHtml = mainMatch ? mainMatch[0] : cleaned;

    // タグを除去して余白を整理
    let text = targetHtml
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join("\n");

    return text;
}

// 送信用に都道府県・状態をわかりやすく整理（見易さ用）
function formatForDiscord(rawText) {
    const lines = rawText.split("\n");
    const filtered = lines.filter(line => 
        /(愛知|福岡|神奈川|大阪|徳島|千葉|埼玉|発売|受付|予定枚数|販売|終了|完売)/.test(line)
    );
    if (filtered.length === 0) {
        // 条件に引っかからない場合は先頭数行を表示
        return lines.slice(0, 15).join("\n");
    }
    return filtered.slice(0, 30).join("\n");
}

// =====================
// Discord送信処理
// =====================

async function sendDiscord(message) {
    if (!DISCORD_WEBHOOK) return;
    for (let i = 1; i <= 3; i++) {
        try {
            const res = await fetch(DISCORD_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message })
            });
            if (res.ok) return;
        } catch (e) {
            await sleep(3000);
        }
    }
}

// =====================
// 監視処理（1回分）
// =====================

async function monitorOnce() {
    console.log("====================");
    console.log("実行時刻:", nowJP());
    
    pullLatest();

    let fullText = "";
    try {
        const html = await fetchHTML(TARGET_URL);
        fullText = extractPageContent(html);
    } catch (e) {
        console.error("データ取得失敗:", e.message);
        return;
    }

    let oldText = "";
    if (fs.existsSync(DATA_FILE)) {
        oldText = fs.readFileSync(DATA_FILE, "utf8");
    }

    const summaryText = formatForDiscord(fullText);

    // 初回登録
    if (!oldText.trim()) {
        fs.writeFileSync(DATA_FILE, fullText, "utf8");
        commitAndPush("Update initial ticket list data");
        
        const msg = `【ローチケ一覧監視｜初回登録】\n${nowJP()}\n\n【概要（一部抜粋）】\n${summaryText}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        return;
    }

    // 変更判定（ページ全体テキストの完全比較）
    if (oldText !== fullText) {
        fs.writeFileSync(DATA_FILE, fullText, "utf8");
        commitAndPush(`Update ticket list status diff: ${nowJP()}`);
        
        const msg = `【ローチケ一覧監視｜変更検知】\n${nowJP()}\n\n【最新状況（一部抜粋）】\n${summaryText}\n\n【ローチケURL】\n${TARGET_URL}\n\n@everyone\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        console.log("変更検知・通知完了");
    } else {
        const msg = `【ローチケ一覧監視｜変更なし】\n${nowJP()}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        console.log("変更なし通知完了");
    }
}

// =====================
// 次回確認時刻（5分間隔）
// =====================

function getNextCheckTime() {
    const now = new Date();
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    for (const minute of minutes) {
        const next = new Date(now);
        next.setMinutes(minute, 0, 0);
        if (next > now) return next;
    }
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return nextHour;
}

// =====================
// メインループ
// =====================

async function mainLoop() {
    const END_TIME_MS = 21480000; // 5時間58分
    const startTime = Date.now();
    const endTime = startTime + END_TIME_MS;

    console.log("一覧監視開始:", nowJP());

    while (true) {
        if (Date.now() >= endTime) break;

        await monitorOnce();

        const next = getNextCheckTime();
        const wait = next.getTime() - Date.now();

        if (Date.now() + wait >= endTime) break;

        console.log(`次回確認: ${next.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
        if (wait > 0) await sleep(wait);
    }
    console.log("監視終了");
}

mainLoop();
