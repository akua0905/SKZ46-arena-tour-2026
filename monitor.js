// =====================
// monitor.js (メンテナンス後対応・行ズレ防止版)
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
// HTML取得（耐性強化）
// =====================

async function fetchHTML(url) {
    const maxRetries = 5;
    
    for (let i = 1; i <= maxRetries; i++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => { controller.abort(); }, 20000);
            
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ja-JP,ja;q=0.9",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache"
                },
                signal: controller.signal
            });
            clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.text();
        } catch (e) {
            console.log(`取得試行 ${i}/${maxRetries} 失敗: ${e.message}`);
            if (i === maxRetries) throw e;
            
            const waitMs = Math.floor(Math.random() * 7000) + 5000;
            console.log(`${waitMs / 1000} 秒待機して再試行します...`);
            await sleep(waitMs);
        }
    }
}

// =====================
// 解析処理（ノイズ除去＆重要情報の抽出）
// =====================

const S = String.fromCharCode(42);

function extractCleanedLines(html) {
    const scriptRegex = new RegExp("<script[\\s\\S]" + S + "?</script>", "gi");
    const styleRegex = new RegExp("<style[\\s\\S]" + S + "?</style>", "gi");
    const commentRegex = new RegExp("<!--[\\s\\S]" + S + "?-->", "gi");

    let cleaned = html
        .replace(scriptRegex, "")
        .replace(styleRegex, "")
        .replace(commentRegex, "");

    let mainMatch = cleaned.match(/<main[\\s\\S]*?<\/main>/i) || cleaned.match(/<body[\\s\\S]*?<\/body>/i);
    let targetHtml = mainMatch ? mainMatch[0] : cleaned;

    // タグ除去後のテキスト行を取得
    let rawLines = targetHtml
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // 不要なアイコン用テキストや記号を除外するフィルター
    const noisePatterns = /^(warning|arrow_forward_ios|keyboard_arrow_right|check|info|・|選択する|詳細|お申し込み|お申込はこちら|チケット|購入|カート)$/i;

    // 重要キーワード（都道府県、ステータス、受付方法など）が含まれる行だけを抽出
    const importantPatterns = /(愛知|福岡|神奈川|大阪|徳島|千葉|埼玉|兵庫|広島|宮城|香川|北海道|愛媛|石川|新潟|発売中|予定枚数終了|受付前|受付終了|販売再開|一般発売|先行|先着|抽選)/;

    let cleanLines = [];
    for (let line of rawLines) {
        if (noisePatterns.test(line)) continue;
        if (importantPatterns.test(line)) {
            cleanLines.push(line);
        }
    }

    return cleanLines;
}

// 差分チェック処理（変更箇所の明確化）
function getDiffSummary(oldLines, newLines) {
    let diffs = [];
    let maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
        let oldLine = oldLines[i] || "（なし）";
        let newLine = newLines[i] || "（なし）";

        if (oldLine !== newLine) {
            diffs.push(`前: ${oldLine}\n後: ${newLine}`);
        }
    }

    if (diffs.length === 0) return null;
    
    if (diffs.length > 10) {
        return diffs.slice(0, 10).join("\n\n") + `\n\n...他 ${diffs.length - 10} 箇所の変更あり`;
    }
    return diffs.join("\n\n");
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

    let currentLines = [];
    try {
        const html = await fetchHTML(TARGET_URL);
        currentLines = extractCleanedLines(html);
    } catch (e) {
        console.error("データ取得最終失敗:", e.message);
        return;
    }

    const currentText = currentLines.join("\n");

    let oldText = "";
    if (fs.existsSync(DATA_FILE)) {
        oldText = fs.readFileSync(DATA_FILE, "utf8");
    }

    // 初回登録
    if (!oldText.trim()) {
        fs.writeFileSync(DATA_FILE, currentText, "utf8");
        commitAndPush("Update initial ticket list data");
        
        const msg = `【ローチケ一覧監視｜初回登録】\n${nowJP()}\n\n【監視対象（抽出データ抜粋）】\n${currentLines.slice(0, 12).join("\n")}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        return;
    }

    // 差分確認
    const oldLines = oldText.split("\n");
    const diffMessage = getDiffSummary(oldLines, currentLines);

    if (diffMessage) {
        fs.writeFileSync(DATA_FILE, currentText, "utf8");
        commitAndPush(`Update ticket list status diff: ${nowJP()}`);
        
        const msg = `【ローチケ一覧監視｜変更検知】\n${nowJP()}\n\n【変更内容】\n${diffMessage}\n\n【ローチケURL】\n${TARGET_URL}\n\n@everyone\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
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
