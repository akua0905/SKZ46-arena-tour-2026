// ==========================================
// ローチケ チケット一覧監視版⑤
// 公演カード抽出版
// ==========================================

import fs from "fs";


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
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"

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
// HTML整理
// ==============================

function cleanHTML(html){


    let text = html;



    // script削除

    text =
    text.replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    );


    text =
    text.replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
    );



    // タグ削除

    text =
    text.replace(
        /<[^>]+>/g,
        " "
    );


    text =
    text.replace(
        /&nbsp;/g,
        " "
    );


    text =
    text.replace(
        /\s+/g,
        " "
    );


    return text;

}



// ==============================
// 公演情報抽出
// ==============================

function extractTickets(html){


    const text =
    cleanHTML(html);



    const results = [];



    const patterns = [

        /(\d{1,2}\.\d{1,2}.*?)(兵庫県|広島県|千葉県|宮城県|香川県).*?(発売中|予定枚数終了|発売前|受付終了).*?(一般発売.*?先着)/g

    ];



    for(
        const regex of patterns
    ){


        let match;


        while(
            (match = regex.exec(text))
        ){


            results.push(

`${match[1]}
${match[2]}
状態:${match[3]}
${match[4]}`

            );

        }

    }



    // 重複削除

    return [
        ...new Set(results)
    ]
    .join("\n\n");

}



// ==============================
// 差分
// ==============================

function makeMessage(oldText,newText){


    return `🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

変更前:
${oldText.substring(0,1000)}

↓

変更後:
${newText.substring(0,1000)}

確認:
${TARGET_URL}`;

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
    extractTickets(html);



    console.log(
        "抽出文字数:",
        ticketList.length
    );



    console.log(
        "===== 抽出結果 ====="
    );


    console.log(
        ticketList
    );


    console.log(
        "===================="
    );



    console.log(
        "保存ファイル存在:",
        fs.existsSync(DATA_FILE)
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


        console.log(
            "変更検知"
        );


        await sendDiscord(
            makeMessage(
                old,
                ticketList
            )
        );


    }else{


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
