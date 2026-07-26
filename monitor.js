// ==========================================
// ローチケページ差分監視版
// GitHub Actions版
// ==========================================


const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;


const HASH_FILE =
"page_hash.txt";


// ==========================================
// Discord通知
// ==========================================

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



// ==========================================
// HTML取得
// ==========================================

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



// ==========================================
// 不要部分除去
// ==========================================

function cleanHTML(html){


    let text = html;


    // 改行削除
    text =
    text.replace(
        /\s+/g,
        " "
    );


    // 時刻・日時系除去

    text =
    text.replace(
        /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g,
        ""
    );


    text =
    text.replace(
        /\d{1,2}:\d{2}:\d{2}/g,
        ""
    );


    // Cookie・セッション系除去

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



// ==========================================
// 簡易ハッシュ
// ==========================================

function hash(str){

    let h = 0;


    for(
        let i=0;
        i<str.length;
        i++
    ){

        h =
        ((h << 5) - h)
        + str.charCodeAt(i);


        h |= 0;

    }


    return h.toString();

}



// ==========================================
// 保存
// ==========================================

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
    hash(cleaned);



    console.log(
        "現在HASH:",
        currentHash
    );



    let oldHash = null;



    try{

        oldHash =
        await Bun.file(
            HASH_FILE
        ).text();

    }catch(e){

    }



    if(!oldHash){


        await Bun.write(
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


        await sendDiscord(

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

ページ内容に変更があります。

確認:
${TARGET_URL}`

        );


        console.log(
            "変更検知 通知送信"
        );


    }
    else{

        console.log(
            "変更なし"
        );

    }



    await Bun.write(
        HASH_FILE,
        currentHash
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
