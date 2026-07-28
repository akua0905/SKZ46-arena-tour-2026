// =====================
// monitor.js (統合版)
// =====================

import fs from "fs";
import { execSync } from "child_process";

// =====================
// 設定
// =====================

const URL_LIST = "https://l-tike.com/concert/mevent/?mid=366800";
const URL_CHIBA = "https://l-tike.com/order/?gLcode=94035&gPfKey=20260410000002181264,20260410000002181263&gEntryMthd=02&gScheduleNo=9&gCarrierCd=01&gPfName=櫻坂４６&gBaseVenueCd=34275";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const DATA_FILE = "combined_ticket_data.txt";
const LAST_DIFF_FILE = "last_combined_diff.txt";

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
        let filesToAdd = [];
        if (fs.existsSync(DATA_FILE)) filesToAdd.push(DATA_FILE);
        if (fs.existsSync(LAST_DIFF_FILE)) filesToAdd.push(LAST_DIFF_FILE);
        
        if (filesToAdd.length > 0) {
            execSync(`git add ${filesToAdd.join(" ")}`);
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
// 解析処理
// =====================

const S = String.fromCharCode(42);

function cleanHTML(html) {
    const scriptRegex = new RegExp("<script[\\s\\S]" + S + "?</script>", "gi");
    const styleRegex = new RegExp("<style[\\s\\S]" + S + "?</style>", "gi");
    return html
        .replace(scriptRegex, "")
        .replace(styleRegex, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ");
}

// 1. 一覧ページ用抽出
function parseList(html) {
    const text = cleanHTML(html);
    const prefPattern = "(愛知県|福岡県|神奈川県|大阪府|徳島県|千葉県|埼玉県)";
    const statusPattern = "(予定枚数終了|発売中|販売中|受付中|受付終了|発売前)";
    const regex = new RegExp(`(${prefPattern}).${S}?(${statusPattern})`, "g");
    
    const result = [];
    let match;
    while ((match = regex.exec(text))) {
        result.push(`${match[1]}: ${match[2]}`);
    }
    return [...new Set(result)].join("\n");
}

// 2. 千葉詳細用抽出
function parseChiba(html) {
    const text = cleanHTML(html);
    const datePattern = "\\d{4}\\/\\d{1,2}\\/\\d{1,2}\\([月火水木金土日]\\)";
    const statusPattern = "(予定枚数終了|発売中|販売中|受付中|受付終了|発売前)";
    const anyLazy = "." + S + "?";
    
    const pattern = `(${datePattern})${anyLazy}${statusPattern}${anyLazy}(\\[開場\\]\\s*\\d{1,2}:\\d{2})${anyLazy}(\\[開演\\]\\s*\\d{1,2}:\\d{2})`;
    const regex = new RegExp(pattern, "g");
    
    const result = [];
    let match;
    while ((match = regex.exec(text))) {
        result.push(`${match[1]}\n状態:${match[2]}\n${match[3]}\n${match[4]}`);
    }
    return [...new Set(result)].join("\n\n");
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

    let listText = "";
    let chibaText = "";

    try {
        const listHtml = await fetchHTML(URL_LIST);
        listText = parseList(listHtml);
        
        const chibaHtml = await fetchHTML(URL_CHIBA);
        chibaText = parseChiba(chibaHtml);
    } catch (e) {
        console.error("データ取得失敗:", e.message);
        return;
    }

    // 上部：一覧 / 下部：千葉詳細
    const currentCombined = `【都道府県一覧】\n${listText}\n\n====================\n\n【千葉公演詳細】\n${chibaText}`;

    let oldText = "";
    if (fs.existsSync(DATA_FILE)) {
        oldText = fs.readFileSync(DATA_FILE, "utf8");
    }

    // 初回登録
    if (!oldText.trim()) {
        fs.writeFileSync(DATA_FILE, currentCombined, "utf8");
        commitAndPush("Update initial combined ticket data");
        
        const msg = `【ローチケ監視｜初回登録】\n${nowJP()}\n\n${currentCombined}\n\n【一覧URL】\n${URL_LIST}\n\n【千葉詳細URL】\n${URL_CHIBA}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        return;
    }

    // 変更判定
    if (oldText !== currentCombined) {
        fs.writeFileSync(DATA_FILE, currentCombined, "utf8");
        commitAndPush(`Update ticket data diff: ${nowJP()}`);
        
        const msg = `【ローチケ監視｜変更検知】\n${nowJP()}\n\n${currentCombined}\n\n【一覧URL】\n${URL_LIST}\n\n【千葉詳細URL】\n${URL_CHIBA}\n\n@everyone\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
        await sendDiscord(msg);
        console.log("変更検知・通知完了");
    } else {
        const msg = `【ローチケ監視｜変更なし】\n${nowJP()}\n\n【一覧URL】\n${URL_LIST}\n\n【千葉詳細URL】\n${URL_CHIBA}\n\n〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
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

    console.log("統合監視開始:", nowJP());

    while (true) {
        if (Date.now() >= endTime) break;

        await monitorOnce();

        const next = getNextCheckTime();
        const wait = next.getTime() - Date.now();

        if (Date.now() + wait >= endTime) break;

        console.log(`次回確認: ${next.toLocaleString("ja-JP")}`);
        if (wait > 0) await sleep(wait);
    }
    console.log("監視終了");
}

mainLoop();
