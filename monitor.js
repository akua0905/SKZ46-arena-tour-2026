// ==========================================
// ローチケ チケット一覧差分監視版
// GitHub Actions / Node.js対応
// ==========================================

import fs from "fs";


// ==============================
// 設定
// ==============================

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;


const DATA_FILE =
"ticket_list.txt";



// ==============================
// Discord通知
// ==============================

async function sendDiscord(message){

    if(!DISCORD_WEBHOOK){
        console.log("Webhook未設定");
        return;
    }


    await fetch(
        DISCORD_WEBHOOK,
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                content:message
            })
        }
    );

}



// ==============================
// HTML取得
// ==============================

async function getHTML(){


    const res =
    await fetch(
        TARGET_URL,
        {
            headers:{

                "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",

                "Accept":
                "text/html,application/xhtml+xml"

            }
        }
    );


    if(!res.ok){

        throw new Error(
            `HTTP ${res.status}`
        );

    }


    return await res.text();

}



// ==============================
// チケット一覧抽出
// ==============================

function extractTicketList(html){


    let start =
    html.indexOf(
        "チケット一覧"
    );


    if(start === -1){

        console.log(
            "チケット一覧開始位置なし"
        );

        start = 0;

    }



    let end =
    html.indexOf(
        "選択する",
        start
    );


    if(end === -1){

        end =
        start + 50000;

    }
    else{

        end += 5000;

    }



    let area =
    html.substring(
        start,
        end
    );



    // HTMLタグ除去

    area =
    area.replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    );


    area =
    area.replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
    );


    area =
    area.replace(
        /<[^>]+>/g,
        " "
    );



    // HTMLエンティティ整理

    area =
    area.replace(
        /&nbsp;/g,
        " "
    );



    // 空白整理

    area =
    area.replace(
        /\s+/g,
        " "
    );



    return area.trim();

}



// ==============================
// 差分作成
// ==============================

function createDiff(oldText,newText){


    const oldLines =
    oldText.split(" ");


    const newLines =
    newText.split(" ");



    let removed = [];

    let added = [];



    for(
        const item of oldLines
    ){

        if(
            !newLines.includes(item)
            &&
            item.length > 1
        ){

            removed.push(item);

        }

    }



    for(
        const item of newLines
    ){

        if(
            !oldLines.includes(item)
            &&
            item.length > 1
        ){

            added.push(item);

        }

    }



    return {

        removed:
        [...new Set(removed)].slice(0,30),

        added:
        [...new Set(added)].slice(0,30)

    };

}



// ==============================
// メイン
// ==============================

async function main(){


    console.log(
        "ローチケ取得開始"
    );



    const html =
    await getHTML();



    console.log(
        "HTML文字数:",
        html.length
    );



    const ticketList =
    extractTicketList(html);



    console.log(
        "チケット一覧文字数:",
        ticketList.length
    );



    let old = "";



    if(
        fs.existsSync(DATA_FILE)
    ){

        old =
        fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

    }



    if(!old){


        fs.writeFileSync(
            DATA_FILE,
            ticketList
        );


        console.log(
            "初回登録"
        );


        return;

    }



    if(
        old !== ticketList
    ){


        const diff =
        createDiff(
            old,
            ticketList
        );



        let message =

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

【変更前】
${diff.removed.join(" ") || "なし"}

【変更後】
${diff.added.join(" ") || "なし"}

確認:
${TARGET_URL}`;



        await sendDiscord(
            message
        );


        console.log(
            "変更通知送信"
        );


    }
    else{


        console.log(
            "変更なし"
        );

    }



    fs.writeFileSync(
        DATA_FILE,
        ticketList
    );


}



main()
.catch(
    async error=>{

        console.error(error);


        await sendDiscord(
`⚠️ ローチケ監視エラー

${error.message}`
        );


        process.exit(1);

    }
);
