// =====================
// monitor_detail.js
// =====================

import fs from "fs";
import { execSync } from "child_process";

// =====================
// 設定
// =====================

const TARGET_URL = "https://l-tike.com/order/?gLcode=94035&gPfKey=20260410000002181264,20260410000002181263&gEntryMthd=02&gScheduleNo=9&gCarrierCd=01&gPfName=櫻坂４６&gBaseVenueCd=34275";
const EVENT_NAME = "櫻坂46 ARENA TOUR 2026 (千葉公演詳細)";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const DATA_FILE = "ticket_detail_list.txt";
const LAST_DIFF_FILE = "last_detail_diff.txt";

// =====================
// 日本時間取得
// =====================

function nowJP() {
    return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// =====================
// 待機処理
// =====================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================
// Gitコミット＆プッシュ
// =====================

function commitAndPush(commitMessage) {
    try {
        const branch = process.env.GITHUB_REF_NAME || "main";
        execSync('git config user.name "github-actions[bot]"');
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
        execSync(`git add --ignore-unmatch ${DATA_FILE} ${LAST_DIFF_FILE}`);
        try {
            execSync(`git commit -m "${commitMessage}"`);
            execSync(`git push origin HEAD:${branch}`);
            console.log("GitHubへ即時保存完了");
        } catch (e) {
            console.log("Gitコミット対象なし、または書き込み不要");
        }
    } catch (e) {
        console.error("Git Push失敗:", e.message);
    }
}

// =====================
// Discord通知フォーマット生成
// =====================

function buildChangeMessage(diff) {
    return `【ローチケ詳細監視｜⚠️変更検知】
　${nowJP()}

【更新内容】
${diff}

【ローチケURL】
${TARGET_URL}

@everyone
〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
}

function buildNoChangeMessage() {
    return `【ローチケ詳細監視｜変更なし】
${nowJP()}

【ローチケURL】
${TARGET_URL}

〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
}

function buildInitialMessage() {
    return `【ローチケ詳細監視｜初回登録】
${nowJP()}

【更新内容】
初回詳細データを登録しました。

【ローチケURL】
${TARGET_URL}

〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
}

function buildErrorMessage(errorText) {
    return `【ローチケ詳細監視｜エラー】
${nowJP()}

【更新内容】
${errorText}

【ローチケURL】
${TARGET_URL}

〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
}

function buildNoticeMessage(title, text) {
    return `【ローチケ詳細監視｜${title}】
${nowJP()}

【更新内容】
${text}

【ローチケURL】
${TARGET_URL}

@everyone
〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜`;
}

// =====================
// Discord送信処理
// =====================

async function sendDiscord(message) {
    if (!DISCORD_WEBHOOK) {
        console.log("Webhook未設定");
        return;
    }

    for (let i = 1; i <= 3; i++) {
        try {
            const res = await fetch(DISCORD_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            console.log("Discord送信完了");
            return;
        } catch (e) {
            console.log(`Discord送信失敗 ${i}/3`, e.message);
            await sleep(i === 1 ? 3000 : (i === 2 ? 6000 : 9000));
        }
    }
}

// =====================
// HTML取得
// =====================

async function getHTML() {
    for (let i = 1; i <= 3; i++) {
        try {
            console.log(`取得試行 ${i}/3`);
            const controller = new AbortController();
            const timer = setTimeout(() => { controller.abort(); }, 30000);
            
            const response = await fetch(TARGET_URL, {
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
            console.log("HTML取得完了");
            return await response.text();
        } catch (e) {
            console.log("取得失敗:", e.message);
            if (i === 3) throw e;
            await sleep(i === 1 ? 3000 : (i === 2 ? 6000 : 9000));
        }
    }
}

// =====================
// HTML整形
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

// =====================
// 日程・時間・ステータス抽出
// =====================

function extractTickets(html) {
    const text = cleanHTML(html);
    const datePattern = "\\d{4}\\/\\d{1,2}\\/\\d{1,2}\\([月火水木金土日]\\)";
    const statusPattern = "(予定枚数終了|発売中|販売中|受付中|受付終了|発売前)";
    const anyLazy = "." + S + "?";
    
    const pattern = `(${datePattern})${anyLazy}${statusPattern}${anyLazy}(\\[開場\\]\\s*\\d{1,2}:\\d{2})${anyLazy}(\\[開演\\]\\s*\\d{1,2}:\\d{2})`;
    const regex = new RegExp(pattern, "g");
    
    const result = [];
    let match;
    while ((match = regex.exec(text))) {
        result.push(
`${match[1]}

状態:${match[2]}
${match[3]}
${match[4]}`
        );
    }
    return [...new Set(result)];
}

// =====================
// 差分確認
// =====================

function getDiff(oldText, newList) {
    const oldItems = oldText.split("\n\n");
    const changes = [];
    
    for (const newItem of newList) {
        const lines = newItem.split("\n");
        const date = lines[0];
        const newStatusLine = lines.find(x => x.startsWith("状態:"));
        
        if (!date || !newStatusLine) continue;
        
        const oldItem = oldItems.find(x => x.includes(date));
        if (!oldItem) continue;
        
        const oldStatusLine = oldItem.split("\n").find(x => x.startsWith("状態:"));
        
        if (oldStatusLine && oldStatusLine !== newStatusLine) {
            changes.push(
`${date}

${oldStatusLine.replace("状態:", "")}
↓
${newStatusLine.replace("状態:", "")}`
            );
        }
    }
    return changes.join("\n\n");
}

// =====================
// 監視処理
// =====================

async function monitorOnce() {
    console.log("====================");
    console.log("実行時刻:", nowJP());
    console.log("ローチケ詳細取得開始");
    
    let html;
    try {
        html = await getHTML();
    } catch (e) {
        const message = buildErrorMessage(`取得失敗: ${e.message}`);
        await sendDiscord(message);
        return;
    }
    
    console.log("HTML文字数:", html.length);
    const currentList = extractTickets(html);
    const currentText = currentList.join("\n\n");
    
    let oldText = "";
    if (fs.existsSync(DATA_FILE)) {
        oldText = fs.readFileSync(DATA_FILE, "utf8");
    }
    
    fs.writeFileSync(DATA_FILE, currentText, "utf8");
    
    // 初回登録
    if (!oldText) {
        if (fs.existsSync(LAST_DIFF_FILE)) {
            fs.unlinkSync(LAST_DIFF_FILE);
        }
        commitAndPush("Update initial detail ticket data");
        const message = buildInitialMessage();
        await sendDiscord(message);
        return;
    }
    
    const diff = getDiff(oldText, currentList);
    
    let lastDiff = "";
    if (fs.existsSync(LAST_DIFF_FILE)) {
        lastDiff = fs.readFileSync(LAST_DIFF_FILE, "utf8");
    }
    
    // 変更あり
    if (diff && diff !== lastDiff) {
        fs.writeFileSync(LAST_DIFF_FILE, diff, "utf8");
        commitAndPush(`Update ticket detail status diff: ${nowJP()}`);
        const message = buildChangeMessage(diff);
        await sendDiscord(message);
        console.log("変更通知送信＆即時Push完了");
    }
    // 変更なし
    else {
        if (diff === "" && fs.existsSync(LAST_DIFF_FILE)) {
            fs.unlinkSync(LAST_DIFF_FILE);
            commitAndPush("Reset last detail diff");
        }
        const message = buildNoChangeMessage();
        await sendDiscord(message);
        console.log("変更なし通知送信");
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
// メインループ（5時間58分運用）
// =====================

async function mainLoop() {
    const NOTICE_TIME_MS = 21000000; // 5時間50分
    const END_TIME_MS = 21480000;    // 5時間58分

    const startTime = Date.now();
    const endTime = startTime + END_TIME_MS;
    let isNoticeSent = false;

    console.log("詳細監視開始:", nowJP());

    while (true) {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= NOTICE_TIME_MS && !isNoticeSent) {
            isNoticeSent = true;
            const noticeMessage = buildNoticeMessage(
                "まもなく再起動",
                "詳細監視開始から5時間50分が経過しました。\n約8分後の5時間58分時点で一旦停止し、次のスケジュールで再起動します。"
            );
            await sendDiscord(noticeMessage);
        }

        if (Date.now() >= endTime) break;

        await monitorOnce();

        const next = getNextCheckTime();
        const wait = next.getTime() - Date.now();

        if (Date.now() + wait >= endTime) break;

        console.log(`次回確認:\n${next.toLocaleString("ja-JP")}`);
        if (wait > 0) await sleep(wait);
    }

    const endMessage = buildNoticeMessage(
        "一旦停止",
        "5時間58分の詳細監視期間が経過したため一旦停止します。\nデータの保存を行い、次の定刻に自動再起動します。"
    );
    await sendDiscord(endMessage);
    console.log("詳細監視終了");
}

// =====================
// 実行
// =====================

mainLoop().catch(async (e) => {
    console.error(e);
    const message = buildErrorMessage(`予期せぬエラー: ${e.message}`);
    await sendDiscord(message);
});
