// ==========================================
// ローチケ チケット一覧監視版④
// 抽出精度改善版
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
                        "text/html"

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
// チケット一覧抽出
// ==============================

function extractTicketList(html){


    // JavaScript定義部分を除去

    html =
    html.replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    );


    html =
    html.replace(
        /Codes\.[\s\S]*?};/g,
        ""
    );



    let text =
    html.replace(
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



    const areas = [

        "兵庫県",
        "広島県",
        "千葉県",
        "宮城県",
        "香川県"

    ];



    const statuses = [

        "発売中",
        "予定枚数終了",
        "発売前",
        "受付終了"

    ];



    let result = [];



    for(
        const area of areas
    ){


        let index =
        text.indexOf(
            area
        );


        if(index === -1){
            continue;
        }



        let block =
        text.substring(
            index,
            index + 200
        );



        let status =
        statuses.find(
            s=>block.includes(s)
        );



        let sale =
        block.includes(
            "一般発売"
        )
        ?
        "一般発売"
        :
        "";



        result.push(

`${block.substring(0,100)}
状態:${status || "不明"}
${sale}`

        );


    }



    return result.join("\n\n");

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

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

変更前:
${old.substring(0,1000)}

↓

変更後:
${ticketList.substring(0,1000)}

${TARGET_URL}`

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
    async e=>{

        console.error(e);


        await sendDiscord(
`⚠️ ローチケ監視エラー

${e.message}`
        );


        process.exit(1);

    }
);
