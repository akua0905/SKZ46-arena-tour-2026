// =====================
// monitor.js (変更内容のみ・シンプル通知版)
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
// 解析処理（受付ごとの独立管理＆改行フォーマット）
// =====================

const S = String.fromCharCode(42);

function extractPrefAndStatus(html) {
    const scriptRegex = new RegExp("<script[\\s\\S]" + S + "?</script>", "gi");
    const styleRegex = new RegExp("<style[\\s\\S]" + S + "?</style>", "gi");
    const commentRegex = new RegExp("<!--[\\s\\S]" + S + "?-->", "gi");

    let cleaned = html
        .replace(scriptRegex, "")
        .replace(styleRegex, "")
        .replace(commentRegex, "");

    let mainMatch = cleaned.match(/<main[\\s\\S]*?<\/main>/i) || cleaned.match(/<body[\\s\\S]*?<\/body>/i);
    let targetHtml = mainMatch ? mainMatch[0] : cleaned;

    let rawLines = targetHtml
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const prefs = ["北海道", "宮城県", "愛知県", "福岡県", "神奈川県", "大阪府", "徳島県", "千葉県", "埼玉県", "兵庫県", "広島県", "香川県", "石川県", "新潟県", "愛媛県"];
    const statuses = ["予定枚数終了", "発売中", "受付中", "販売中", "受付終了", "発売前", "受付前", "販売再開"];

    let items = [];
    let currentPref = "";

    for (let line of rawLines) {
        let foundPref = prefs.find(p => line.includes(p));
        if (foundPref) {
            currentPref = foundPref;
        }

        if (currentPref) {
            let foundStatus = statuses.find(s => line === s);
            if (foundStatus) {
                items.push({ pref: currentPref, status: foundStatus });
            }
        }
    }

    let prefCounts = {};
    let resultLines = [];

    for (let item of items) {
        prefCounts[item.pref] = (prefCounts[item.pref] || 0) + 1;
        let label = `${item.pref} (受付${prefCounts[item.pref]})`;
        
        resultLines.push(`${label}\nステータス: ${item.status}`);
    }

    return resultLines;
}

// 差分チェック処理
function getDiffSummary(oldLines, newLines) {
    let parseMap = (lines) => {
        let map = new Map();
        let text = lines.join("\n");
        let blocks = text.split("\n\n");

        for (let block of blocks) {
            let linesInBlock = block.split("\n");
            if (linesInBlock.length >= 2) {
                let key = linesInBlock[0].trim();
                let val = linesInBlock[1].replace("ステータス: ", "").trim();
                map.set(key, val);
            }
        }
        return map;
    };

    let oldMap = parseMap(oldLines);
    let newMap = parseMap(newLines);

    let diffs = [];

    newMap.forEach((status, label) => {
        let oldStatus = oldMap.get(label) || "（なし）";
        if (oldStatus !== status) {
            diffs.push(`【${label}】\n前:\n${oldStatus}\n\n後:\n${status}`);
        }
    });

    if (diffs.length === 0) return null;
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
        currentLines = extractPrefAndStatus(html);
    } catch (e) {
        console.error("データ取得最終失敗:", e.message);
        return;
    }

    const currentText = currentLines.join("\n\n");

    let oldText = "";
    if (fs.existsSync(DATA_FILE)) {
        oldText = fs.readFileSync(DATA_FILE, "utf8");
    }

    // 初回登録
    if (!oldText.trim()) {
        fs.writeFileSync(DATA_FILE, currentText, "utf8");
        commitAndPush("Update initial ticket list data");
        
        const msg = `【ローチケ一覧監視｜初回登録】\n${nowJP()}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
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
    const endMsg = `【ローチケ一覧監視｜監視終了】\n${nowJP()}\n\n規定の監視時間（約6時間）が経過したため、監視を終了しました。\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
    await sendDiscord(endMsg);
}

mainLoop();
