// ==========================================
// ローチケページ差分監視版
// Node.js / GitHub Actions対応
// ==========================================

import fs from "fs";


// ==============================
// 設定
// ==============================

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;


const HASH_FILE =
"page_hash.txt";



// ==============================
// Discord通知
// ==============================

async function sendDiscord(message){

    if(!DISCORD_WEBHOOK){

        console.log(
            "Webhook未設定"
        );

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
// ページ取得
// ==============================

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
                60000
            );



            const res =
            await fetch(
                TARGET_URL,
                {
                    signal:
                    controller.signal,

                    headers:{

                        "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",

                        "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                        "Accept-Language":
                        "ja-JP,ja;q=0.9"

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



        }catch(error){


            console.log(
                "取得失敗:",
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
// 不要変化除去
// ==============================

function cleanHTML(html){


    let text =
    html;


    // 改行・空白整理

    text =
    text.replace(
        /\s+/g,
        " "
    );



    // 日時削除

    text =
    text.replace(
        /\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/g,
        ""
    );


    text =
    text.replace(
        /\d{1,2}:\d{2}(:\d{2})?/g,
        ""
    );



    // ランダム値削除

    text =
    text.replace(
        /session[a-zA-Z0-9_-]*/gi,
        ""
    );


    text =
    text.replace(
        /token[a-zA-Z0-9_-]*/gi,
        ""
    );



    return text;

}



// ==============================
// ハッシュ生成
// ==============================

function createHash(text){


    let hash =
    0;


    for(
        let i=0;
        i<text.length;
        i++
    ){

        hash =
        ((hash << 5) - hash)
        +
        text.charCodeAt(i);


        hash |= 0;

    }


    return String(hash);

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



    const cleaned =
    cleanHTML(html);



    const currentHash =
    createHash(cleaned);



    console.log(
        "現在HASH:",
        currentHash
    );



    let oldHash =
    null;



    if(
        fs.existsSync(
            HASH_FILE
        )
    ){

        oldHash =
        fs.readFileSync(
            HASH_FILE,
            "utf8"
        );

    }



    if(!oldHash){


        fs.writeFileSync(
            HASH_FILE,
            currentHash
        );


        console.log(
            "初回登録"
        );


        return;

    }



    if(
        oldHash !== currentHash
    ){


        console.log(
            "ページ変更検知"
        );



        await sendDiscord(

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

ローチケページに変更がありました。

確認：
${TARGET_URL}`

        );


    }
    else{


        console.log(
            "変更なし"
        );

    }



    fs.writeFileSync(
        HASH_FILE,
        currentHash
    );


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
