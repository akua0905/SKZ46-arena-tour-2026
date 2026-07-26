// ==========================================
// ローチケ チケット一覧監視版
// 完成版③ 修正版
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

    for(let i=1;i<=3;i++){

        try{

            console.log(
                `取得試行 ${i}/3`
            );

            const controller =
            new AbortController();


            const timer =
            setTimeout(
                ()=>controller.abort(),
                60000
            );


            const res =
            await fetch(
                TARGET_URL,
                {
                    signal:controller.signal,

                    headers:{
                        "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",

                        "Accept":
                        "text/html,application/xhtml+xml"
                    }
                }
            );


            clearTimeout(timer);


            if(!res.ok){

                throw new Error(
                    `HTTP ${res.status}`
                );

            }


            return await res.text();


        }catch(e){

            console.log(
                "取得失敗:",
                e.message
            );


            if(i===3){
                throw e;
            }


            await new Promise(
                r=>setTimeout(r,5000)
            );

        }

    }

}


// ==============================
// チケット情報抽出
// ==============================

function extractTicketList(html){


    let result = "";



    // 状態ワード周辺を抽出

    const keywords = [
        "予定枚数終了",
        "発売中",
        "発売前",
        "受付終了",
        "販売中",
        "一般発売先着",
        "選択する"
    ];



    for(const key of keywords){


        let index = 0;


        while(true){


            index =
            html.indexOf(
                key,
                index
            );


            if(index === -1){
                break;
            }


            const start =
            Math.max(
                0,
                index - 500
            );


            const end =
            Math.min(
                html.length,
                index + 500
            );


            result +=
            html.substring(
                start,
                end
            )
            + "\n";


            index += key.length;

        }

    }



    // HTML除去

    result =
    result.replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    );


    result =
    result.replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
    );


    result =
    result.replace(
        /<[^>]+>/g,
        " "
    );


    result =
    result.replace(
        /&nbsp;/g,
        " "
    );


    result =
    result.replace(
        /\s+/g,
        " "
    );


    return result.trim();

}



// ==============================
// 差分作成
// ==============================

function diff(oldText,newText){


    if(!oldText){

        return {
            before:"",
            after:newText
        };

    }


    return {

        before:oldText,

        after:newText

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
        "抽出文字数:",
        ticketList.length
    );


    console.log(
        "===== 抽出結果 ====="
    );


    console.log(
        ticketList.substring(
            0,
            2000
        )
    );


    console.log(
        "===================="
    );



    let old="";


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


        const message =

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

変更前:
${old.substring(0,800)}

↓

変更後:
${ticketList.substring(0,800)}

確認:
${TARGET_URL}`;



        await sendDiscord(
            message
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
    async e=>{

        console.error(e);

        await sendDiscord(
`⚠️ ローチケ監視エラー

${e.message}`
        );

        process.exit(1);

    }
);
