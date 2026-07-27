// =====================
// monitor.js 完成版①
// =====================

import fs from "fs";


// =====================
// 設定
// =====================

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";

const EVENT_NAME =
"櫻坂46 ARENA TOUR 2026";

const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;

const DATA_FILE =
"ticket_list.txt";

const LAST_DIFF_FILE =
"last_diff.txt";


// =====================
// 日本時間
// =====================

function nowJP(){

    return new Date().toLocaleString(
        "ja-JP",
        {
            timeZone:"Asia/Tokyo"
        }
    );

}


// =====================
// Sleep
// =====================

function sleep(ms){

    return new Promise(
        resolve =>
        setTimeout(resolve,ms)
    );

}


// =====================
// Discord送信
// =====================

async function sendDiscord(message){

    if(!DISCORD_WEBHOOK){

        console.log(
            "Webhook未設定"
        );

        return;

    }

    for(
        let i=1;
        i<=3;
        i++
    ){

        try{

            await fetch(
                DISCORD_WEBHOOK,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },

                    body:JSON.stringify({
                        content:message
                    })
                }
            );

            console.log(
                "Discord送信完了"
            );

            return;

        }catch(e){

            console.log(
                `Discord送信失敗 ${i}/3`,
                e.message
            );

            await sleep(3000);

        }

    }

}



// =====================
// HTML取得
// =====================

async function getHTML(){

    for(
        let i=1;
        i<=3;
        i++
    ){

        try{

            console.log(
                `取得試行 ${i}/3`
            );

            const controller =
            new AbortController();

            const timer =
            setTimeout(
                ()=>{
                    controller.abort();
                },
                30000
            );

            const response =
            await fetch(
                TARGET_URL,
                {

                    method:"GET",

                    headers:{

                        "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",

                        "Accept":
                        "text/html,application/xhtml+xml",

                        "Accept-Language":
                        "ja-JP,ja;q=0.9",

                        "Cache-Control":
                        "no-cache"

                    },

                    signal:
                    controller.signal

                }
            );

            clearTimeout(timer);

            if(!response.ok){

                throw new Error(
                    `HTTP ${response.status}`
                );

            }

            console.log(
                "HTML取得完了"
            );

            return await response.text();

        }catch(e){

            console.log(
                "取得失敗:",
                e.message
            );

            if(
                i===3
            ){

                throw e;

            }

            await sleep(3000);

        }

    }

}



// =====================
// HTML整形
// =====================

function cleanHTML(html){

    return html

    .replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    )

    .replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
    )

    .replace(
        /<[^>]+>/g,
        " "
    )

    .replace(
        /&nbsp;/g,
        " "
    )

    .replace(
        /\s+/g,
        " "
    );

}



// =====================
// 都道府県一覧
// =====================

const AREAS = [
    "北海道",
    "青森県",
    "岩手県",
    "宮城県",
    "秋田県",
    "山形県",
    "福島県",
    "茨城県",
    "栃木県",
    "群馬県",
    "埼玉県",
    "千葉県",
    "東京都",
    "神奈川県",
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
    "三重県",
    "滋賀県",
    "京都府",
    "大阪府",
    "兵庫県",
    "奈良県",
    "和歌山県",
    "鳥取県",
    "島根県",
    "岡山県",
    "広島県",
    "山口県",
    "徳島県",
    "香川県",
    "愛媛県",
    "高知県",
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県"
];



// =====================
// チケット抽出
// =====================

function extractTickets(html){

    const text =
    cleanHTML(html);

    const areaPattern =
    AREAS.join("|");

    const regex =
    new RegExp(
        `(\\d{1,2}\\.\\d{1,2}.*?)(` +
        areaPattern +
        `).*?` +
        `(発売中|販売中|受付中|予定枚数終了|発売前|受付終了)` +
        `.*?(一般発売.*?(先着|抽選))`,
        "g"
    );

    const result = [];

    let match;

    while(
        (match = regex.exec(text))
    ){

        result.push(
`${match[1].trim()}
${match[2]}
状態:${match[3]}
${match[4]}`
        );

    }

    return [
        ...new Set(result)
    ];

}



// =====================
// 差分確認
// =====================

function getDiff(
    oldText,
    newList
){

    const oldItems =
    oldText.split("\n\n");

    const changes = [];

    for(
        const newItem of newList
    ){

        const lines =
        newItem.split("\n");

        const date =
        lines[0];

        const area =
        lines.find(
            x =>
            AREAS.includes(x)
        );

        const newStatus =
        lines.find(
            x =>
            x.startsWith("状態:")
        );

        if(
            !date ||
            !area ||
            !newStatus
        ){

            continue;

        }

        const oldItem =
        oldItems.find(
            x =>
            x.includes(date)
            &&
            x.includes(area)
        );

        if(!oldItem){

            continue;

        }

        const oldStatus =
        oldItem
        .split("\n")
        .find(
            x =>
            x.startsWith("状態:")
        );

        if(
            oldStatus &&
            oldStatus !== newStatus
        ){

            changes.push(
`${area}
${date}

${oldStatus.replace("状態:","")}
↓
${newStatus.replace("状態:","")}`
            );

        }

    }

    return changes.join("\n\n");

}

// =====================
// 監視処理
// =====================

async function monitorOnce(){

    console.log(
        "===================="
    );

    console.log(
        "実行時刻:",
        nowJP()
    );

    console.log(
        "ローチケ取得開始"
    );

    let html;

    try{

        html =
        await getHTML();

    }catch(e){

        await sendDiscord(
`⚠️ ローチケ監視｜エラー

${EVENT_NAME}

取得失敗

確認時刻:
${nowJP()}

原因:
${e.message}`
        );

        return;

    }

    console.log(
        "HTML文字数:",
        html.length
    );

    const currentList =
    extractTickets(html);

    const currentText =
    currentList.join("\n\n");

    console.log(
        "===== 抽出結果 ====="
    );

    console.log(
        currentText
    );

    console.log(
        "===================="
    );

    let oldText = "";

    if(
        fs.existsSync(DATA_FILE)
    ){

        oldText =
        fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

    }

    // 毎回最新内容へ更新
    fs.writeFileSync(
        DATA_FILE,
        currentText,
        "utf8"
    );

    // 初回登録
    if(!oldText){

        if(
            fs.existsSync(LAST_DIFF_FILE)
        ){

            fs.unlinkSync(
                LAST_DIFF_FILE
            );

        }

        await sendDiscord(
`🆕 ローチケ監視｜初回登録

${EVENT_NAME}

初回データを登録しました。

確認時刻:
${nowJP()}

確認:
${TARGET_URL}`
        );

        return;

    }

    const diff =
    getDiff(
        oldText,
        currentList
    );

    let lastDiff = "";

    if(
        fs.existsSync(LAST_DIFF_FILE)
    ){

        lastDiff =
        fs.readFileSync(
            LAST_DIFF_FILE,
            "utf8"
        );

    }

    // 変更あり
    if(
        diff &&
        diff !== lastDiff
    ){

        fs.writeFileSync(
            LAST_DIFF_FILE,
            diff,
            "utf8"
        );

        await sendDiscord(
`🎫 ローチケ監視｜変更検知

${EVENT_NAME}

変更内容:

${diff}

確認時刻:
${nowJP()}

確認:
${TARGET_URL}`
        );

        console.log(
            "変更通知送信"
        );

    }

    // 変更なし
    else{

        if(
            diff === ""
            &&
            fs.existsSync(LAST_DIFF_FILE)
        ){

            fs.unlinkSync(
                LAST_DIFF_FILE
            );

        }

        await sendDiscord(
`🟢 ローチケ監視｜変更なし

${EVENT_NAME}

確認時刻:
${nowJP()}

確認:
${TARGET_URL}`
        );

        console.log(
            "変更なし通知送信"
        );

    }

}



// =====================
// 次回確認時刻
// 00・05・10・15・20・25・30・35・40・45・50・55
// =====================

function getNextCheckTime(){

    const now =
    new Date();

    const minutes = [
        0,
        5,
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55
    ];

    for(
        const minute of minutes
    ){

        const next =
        new Date(now);

        next.setMinutes(
            minute,
            0,
            0
        );

        if(
            next > now
        ){

            return next;

        }

    }

    const nextHour =
    new Date(now);

    nextHour.setHours(
        nextHour.getHours()+1,
        0,
        0,
        0
    );

    return nextHour;

}

// =====================
// 約5時間55分監視
// =====================

async function mainLoop(){

    const endTime =
    Date.now()
    +
    (
        (5 * 60 + 55)
        * 60
        * 1000
    );

    console.log(
        "監視開始:",
        nowJP()
    );

    while(
        true
    ){

        if(
            Date.now() >= endTime
        ){

            break;

        }

        await monitorOnce();

        const next =
        getNextCheckTime();

        const wait =
        next.getTime()
        -
        Date.now();

        if(
            Date.now() + wait >= endTime
        ){

            break;

        }

        console.log(
`次回確認:
${next.toLocaleString(
    "ja-JP"
)}`
        );

        if(
            wait > 0
        ){

            await sleep(
                wait
            );

        }

    }

    await sendDiscord(
`⏹️ ローチケ監視終了

${EVENT_NAME}

約5時間55分監視完了

終了時刻:
${nowJP()}`
    );

    console.log(
        "監視終了"
    );

}



// =====================
// 実行
// =====================

mainLoop()
.catch(
    async e=>{

        console.error(
            e
        );

        await sendDiscord(
`⚠️ ローチケ監視｜エラー

${EVENT_NAME}

確認時刻:
${nowJP()}

${e.message}`
        );

    }
);
