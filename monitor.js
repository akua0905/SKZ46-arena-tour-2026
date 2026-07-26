// ==========================================
// ローチケ監視ツール
// GitHub Actions版
// monitor.js
// ==========================================

import axios from "axios";
import fs from "fs";


// ==============================
// 設定
// ==============================

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


// 監視対象
const TARGET_NAME =
"千葉";


// Discord
const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;


// 状態保存
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


    await axios.post(
        DISCORD_WEBHOOK,
        {
            content: message
        }
    );

}



// ==============================
// 状態読み込み
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



// ==============================
// 状態保存
// ==============================

function saveStatus(status){

    fs.writeFileSync(
        STATUS_FILE,
        JSON.stringify(
            status,
            null,
            2
        )
    );

}



// ==============================
// ローチケ取得
// ==============================

async function getPage(){


    const res =
    await axios.get(
        TARGET_URL,
        {
            headers:{
                "User-Agent":
                "Mozilla/5.0"
            },
            timeout:30000
        }
    );


    return res.data;

}



// ==============================
// 状態解析
// ==============================

function analyze(html){


    let status =
    "不明";


    /*
      ローチケ内部状態
      NOW_SALE  = 販売中
      SOLDOUT   = 予定枚数終了
      FINISH    = 受付終了
      BEFORE_SALE = 発売前
    */


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
            index + 10000
        );

    }



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
        "HTML:",
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



    if(old === null){

        saveStatus({
            status:status,
            time:new Date().toISOString()
        });


        console.log(
            "初回登録"
        );


        return;

    }



    if(
        old.status !== status
    ){

        const message =

`🎫 ローチケ更新検知

${TARGET_NAME}公演

${old.status}
↓
${status}

${TARGET_URL}`;


        await sendDiscord(
            message
        );


        console.log(
            "Discord通知送信"
        );


    }



    saveStatus({

        status:status,

        time:new Date().toISOString()

    });



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
