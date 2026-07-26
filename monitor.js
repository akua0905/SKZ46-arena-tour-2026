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



async function sendDiscord(message){

    if(!DISCORD_WEBHOOK){
        console.log("Webhook未設定");
        return;
    }


    const controller =
    new AbortController();


    const timer =
    setTimeout(
        ()=>controller.abort(),
        10000
    );


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
                }),
                signal:controller.signal
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


    }finally{

        clearTimeout(timer);

    }

}




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
                15000
            );


            const res =
            await fetch(
                TARGET_URL,
                {
                    headers:{
                        "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
                    },
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


            console.log(
                "HTML取得完了"
            );


            return await res.text();



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




function cleanHTML(html){


    let text =
    html;


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





function extractTickets(html){


    const text =
    cleanHTML(html);



    const regex =
    /(\d{1,2}\.\d{1,2}.*?)(兵庫県|広島県|千葉県|宮城県|香川県).*?(発売中|予定枚数終了|発売前|受付終了).*?(一般発売.*?先着)/g;



    let result=[];

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
    ]
    .join("\n\n");

}





function getDiff(oldText,newText){


    const oldList =
    oldText.split("\n\n");


    const newList =
    newText.split("\n\n");


    const diff=[];


    for(
        const item of newList
    ){

        if(
            !oldList.includes(item)
        ){

            diff.push(item);

        }

    }


    return diff.join("\n\n");

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


    const now =
    new Date()
    .toLocaleString(
        "ja-JP"
    );


    console.log(
        "===================="
    );


    console.log(
        "実行時刻:",
        now
    );


    console.log(
        "ローチケ取得開始"
    );



    const html =
    await getHTML();



    console.log(
        "HTML文字数:",
        html.length
    );



    const current =
    extractTickets(html);



    console.log(
        "抽出文字数:",
        current.length
    );


    console.log(
        "===== 抽出結果 ====="
    );


    console.log(
        current
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
            current
        );


        console.log(
            "初回登録"
        );


        return;

    }





    if(
        old !== current
    ){


        const diff =
        getDiff(
            old,
            current
        );


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


    }
    else{


        console.log(
            "変更なし"
        );


        if(
            canSendNoChange()
        ){


            await sendDiscord(

`✅ ローチケ監視

変更なし

実行時刻:
${now}`

            );


            fs.writeFileSync(
                NOTICE_FILE,
                String(Date.now())
            );


            console.log(
                "変更なし通知送信"
            );


        }
        else{

            console.log(
                "変更なし通知スキップ"
            );

        }

    }




    fs.writeFileSync(
        DATA_FILE,
        current
    );



}



main()
.catch(
    async e=>{

        console.error(
            "エラー:",
            e.message
        );


        await sendDiscord(

`⚠️ ローチケ監視エラー

${e.message}`

        );


        process.exit(1);

    }
);
