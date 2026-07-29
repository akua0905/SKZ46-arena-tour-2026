// =====================
// monitor.js (フォーマット完全一致・ログ拡張版)
// =====================

import fs from "fs";
import { execSync } from "child_process";

// =====================
// 設定
// =====================

const TARGET_URL = "https://l-tike.com/concert/mevent/?mid=366800";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const DATA_FILE = "ticket_list_data.json"; // 構造化データ保存用

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
// 解析処理（指定フォーマット抽出）
// =====================

const S = String.fromCharCode(42);

function extractTicketItems(html) {
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

    // ブロック単位への分割（日付または都道府県が登場した箇所）
    const dateRegex = /^\d{1,2}\.\d{1,2}$/;
    
    let blocks = [];
    let currentBlock = [];

    for (let line of rawLines) {
        let isPref = prefs.some(p => line.includes(p));
        let isDate = dateRegex.test(line);

        if ((isPref || isDate) && currentBlock.length > 0) {
            let str = currentBlock.join(" ");
            if (statuses.some(s => str.includes(s))) {
                blocks.push(currentBlock);
            }
            currentBlock = [];
        }
        currentBlock.push(line);
    }
    if (currentBlock.length > 0) {
        let str = currentBlock.join(" ");
        if (statuses.some(s => str.includes(s))) {
            blocks.push(currentBlock);
        }
    }

    // ブロックから「都道府県」「日付構造」「ステータス」を解析
    let items = [];
    let prefCounts = {};

    for (let block of blocks) {
        let pref = "";
        let dates = [];
        let status = "";
        let isReopen = false;

        for (let line of block) {
            let foundPref = prefs.find(p => line.includes(p));
            if (foundPref) pref = foundPref;

            if (dateRegex.test(line)) {
                dates.push(line);
            }
            
            // 曜日などの補足要素を拾う
            if (["土曜日", "日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "・"].includes(line)) {
                dates.push(line);
            }

            let foundStatus = statuses.find(s => line === s);
            if (foundStatus) status = foundStatus;

            if (line.includes("販売再開")) isReopen = true;
        }

        if (pref && status) {
            prefCounts[pref] = (prefCounts[pref] || 0) + 1;
            let index = prefCounts[pref];
            
            // 日付表示の整形
            let dateStr = dates.join(" ").replace(/\s+・\s+/g, " ・ ").trim();
            if (!dateStr) dateStr = "全日程";

            // 一意のキーを作成
            let id = `${pref}_${index}${isReopen ? "_reopen" : ""}`;

            items.push({
                id: id,
                pref: pref,
                dateStr: dateStr,
                status: status,
                isReopen: isReopen
            });
        }
    }

    return items;
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

    let currentItems = [];
    try {
        const html = await fetchHTML(TARGET_URL);
        currentItems = extractTicketItems(html);
    } catch (e) {
        console.error("データ取得最終失敗:", e.message);
        return;
    }

    // GitHubのアクション実行ログに全監視対象を出力
    console.log("\n--- 【GitHub実行ログ：現在の全監視受付一覧】 ---");
    currentItems.forEach(item => {
        console.log(`[${item.pref}] ${item.dateStr} | ステータス: ${item.status}${item.isReopen ? ' (販売再開枠)' : ''}`);
    });
    console.log("-----------------------------------------------\n");

    let oldItems = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            oldItems = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        } catch (e) {
            oldItems = [];
        }
    }

    // 初回登録
    if (oldItems.length === 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(currentItems, null, 2), "utf8");
        commitAndPush("Update initial ticket list json");
        
        const msg = `【ローチケ監視｜初回登録】\n　${nowJP()}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        return;
    }

    // 差分チェック
    let oldMap = new Map(oldItems.map(item => [item.id, item]));
    let diffBlocks = [];

    for (let current of currentItems) {
        let old = oldMap.get(current.id);
        if (old) {
            if (old.status !== current.status) {
                diffBlocks.push(`☆${current.pref}☆\n${current.dateStr}\n\n${old.status}\n↓\n${current.status}`);
            }
        }
    }

    if (diffBlocks.length > 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(currentItems, null, 2), "utf8");
        commitAndPush(`Update ticket list status diff: ${nowJP()}`);
        
        const diffText = diffBlocks.join("\n\n");
        const msg = `【ローチケ監視｜変更検知】\n　${nowJP()}\n\n【更新内容】\n${diffText}\n\n【ローチケURL】\n${TARGET_URL}\n\n@everyone\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        console.log("変更検知・Discord通知完了");
    } else {
        const msg = `【ローチケ監視｜変更なし】\n${nowJP()}\n\n【ローチケURL】\n${TARGET_URL}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        console.log("変更なし・Discord通知完了");
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
    const endMsg = `【ローチケ監視｜監視終了】\n${nowJP()}\n\n規定の監視時間（約6時間）が経過したため、監視を終了しました。\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
    await sendDiscord(endMsg);
}

mainLoop();
