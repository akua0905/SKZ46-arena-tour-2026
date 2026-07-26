// ==========================================
// ローチケ監視ツール
// GitHub Actions版
// monitor.js 改良版
// ==========================================

import fs from "fs";


// ==============================
// 設定
// ==============================

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


const TARGET_NAME =
"千葉";


const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;


const STATUS_FILE =
"status.json";



// ==============================
// Discord通知
// ==============================

async function sendDiscord(message){

    if(!DISCORD_WEBHOOK){
        console.log("Webhook未設定");
        return;
    }


    try{

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

    }catch(e){

        console.log(
            "Discord通知失敗:",
            e.message
        );

    }

}



// ==============================
// 状態保存
// ==============================

function loadStatus(){

    if(!fs.existsSync(STATUS_FILE)){
        return null;
    }


    try{

        return JSON.parse(
            fs.readFileSync(
                STATUS_FILE,
                "utf8"
            )
        );


    }catch(e){

        return null;

    }

}



function saveStatus(data){

    fs.writeFileSync(
        STATUS_FILE,
        JSON.stringify(
            data,
            null,
            2
        )
    );

}



// ==============================
// ローチケ取得
// ==============================

async function getPage(){


    const headers = {

        "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",

        "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "Accept-Language":
        "ja-JP,ja;q=0.9,en-US;q=0.8",

        "Cache-Control":
        "no-cache"

    };



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
                ()=>controller.abort(),
                60000
            );



            const res =
            await fetch(
                TARGET_URL,
                {
                    method:"GET",
                    headers,
                    signal:
                    controller.signal
                }
            );


            clearTimeout(timer);



            if(!res.ok){

                throw new Error(
                    `HTTP ${res.status}`
                );

            }



            const html =
            await res.text();



            return html;



        }catch(error){


            console.log(
                `取得失敗 ${i}/3:`,
                error.message
            );



            if(i===3){

                throw error;

            }


            await new Promise(
                r=>setTimeout(r,5000)
            );

        }

    }

}



// ==============================
// 状態解析
// ==============================

function analyze(html){


    let area =
    html;



    const index =
    html.indexOf(
        TARGET_NAME
    );



    if(index !== -1){

        area =
        html.substring(
            index,
            index + 15000
        );

    }



    let status =
    "不明";



    if(
        area.includes("NOW_SALE")
        ||
        area.includes("発売中")
        ||
        area.includes("販売中")
        ||
        area.includes("受付中")
    ){

        status =
        "販売中";

    }

    else if(
        area.includes("SOLDOUT")
        ||
        area.includes("予定枚数終了")
    ){

        status =
        "予定枚数終了";

    }

    else if(
        area.includes("FINISH")
        ||
        area.includes("受付終了")
    ){

        status =
        "受付終了";

    }

    else if(
        area.includes("BEFORE_SALE")
        ||
        area.includes("発売前")
    ){

        status =
        "発売前";

    }



    return status;

}



// ==============================
// メイン
// ==============================

async function main(){


    console.log(
        "ローチケ取得開始"
    );



    const html =
    await getPage();



    console.log(
        "HTML文字数:",
        html.length
    );



    const status =
    analyze(html);



    console.log(
        "現在状態:",
        status
    );



    const old =
    loadStatus();



    if(old===null){


        saveStatus({

            status,

            time:
            new Date().toISOString()

        });



        console.log(
            "初回登録"
        );


        return;

    }



    if(
        old.status !== status
    ){


        await sendDiscord(

`🎫 ローチケ更新検知

${TARGET_NAME}公演

${old.status}
↓
${status}

${TARGET_URL}`

        );


        console.log(
            "Discord通知送信"
        );


    }



    saveStatus({

        status,

        time:
        new Date().toISOString()

    });



}



main()
.catch(
    async error=>{


        console.error(
            error
        );


        await sendDiscord(

`⚠️ ローチケ監視エラー

${error.message}`

        );


        process.exit(1);

    }
);
