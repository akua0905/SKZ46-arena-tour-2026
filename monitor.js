// monitor.js 完成版⑩ コード①

import fs from "fs";

const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";

const DISCORD_WEBHOOK =
process.env.DISCORD_WEBHOOK;

const DATA_FILE =
"ticket_list.txt";

const NOTICE_FILE =
"last_notice.txt";

const NO_CHANGE_INTERVAL =
30 * 60 * 1000;


// Discord通知
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

    }catch(e){

        console.log(
            "Discord送信失敗:",
            e.message
        );

    }

}



// ローチケ取得
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
                ()=>controller.abort(),
                30000
            );


            const response =
            await fetch(
                TARGET_URL,
                {
                    method:"GET",

                    headers:{
                        "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",

                        "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

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


            await new Promise(
                r=>setTimeout(r,3000)
            );

        }

    }

}



// HTML整形
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



// チケット抽出
function extractTickets(html){

    const text =
    cleanHTML(html);


    const regex =
    /(\d{1,2}\.\d{1,2}.*?)(兵庫県|広島県|千葉県|宮城県|香川県).*?(発売中|予定枚数終了|発売前|受付終了).*?(一般発売.*?先着)/g;


    const result=[];

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


// monitor.js 完成版⑩ コード②


function getDiff(oldText,newList){

    const oldItems =
    oldText.split("\n\n");

    const changes=[];


    for(const newItem of newList){

        const newLines =
        newItem.split("\n");


        const date =
        newLines[0];


        const area =
        newLines.find(
            x =>
            [
                "兵庫県",
                "広島県",
                "千葉県",
                "宮城県",
                "香川県"
            ].includes(x)
        );


        const newStatus =
        newLines.find(
            x =>
            x.startsWith("状態:")
        );


        if(!date || !area || !newStatus){
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



function canSendNoChange(){

    if(
        !fs.existsSync(NOTICE_FILE)
    ){
        return true;
    }


    const last =
    Number(
        fs.readFileSync(
            NOTICE_FILE,
            "utf8"
        )
    );


    return (
        Date.now()-last
        >=
        NO_CHANGE_INTERVAL
    );

}



async function main(){

    console.log(
        "===================="
    );


    console.log(
        "実行時刻:",
        new Date().toLocaleString("ja-JP")
    );


    console.log(
        "ローチケ取得開始"
    );


    let html;


    try{

        html =
        await getHTML();


    }catch(e){


        console.log(
            "最終取得失敗:",
            e.message
        );


        await sendDiscord(
`⚠️ ローチケ監視

取得失敗

${e.message}

次回実行で再確認します。`
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
        "抽出文字数:",
        currentText.length
    );


    console.log(
        "===== 抽出結果 ====="
    );


    console.log(
        currentText
    );


    console.log(
        "===================="
    );



    let oldText="";


    if(
        fs.existsSync(DATA_FILE)
    ){

        oldText =
        fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

    }



    if(!oldText){


        fs.writeFileSync(
            DATA_FILE,
            currentText
        );


        console.log(
            "初回登録"
        );


        return;

    }



    const diff =
    getDiff(
        oldText,
        currentList
    );



    if(diff){


        await sendDiscord(

`🎫 ローチケ更新検知

櫻坂46 ARENA TOUR 2026

変更内容:

${diff}

確認:
${TARGET_URL}`

        );


        console.log(
            "変更通知送信"
        );


    }else{


        console.log(
            "変更なし"
        );


        if(
            canSendNoChange()
        ){


            await sendDiscord(

`✅ ローチケ監視

変更なし

実行:
${new Date().toLocaleString("ja-JP")}`

            );


            fs.writeFileSync(
                NOTICE_FILE,
                String(Date.now())
            );


            console.log(
                "変更なし通知送信"
            );


        }else{

            console.log(
                "変更なし通知スキップ"
            );

        }

    }



    fs.writeFileSync(
        DATA_FILE,
        currentText
    );


}



main()
.catch(
    async e=>{

        console.error(
            "予期せぬエラー:",
            e.message
        );


        await sendDiscord(
`⚠️ ローチケ監視エラー

${e.message}`
        );

    }
);
