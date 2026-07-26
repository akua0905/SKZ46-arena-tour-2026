// ==========================================
// ローチケ受付解析 診断版
// ==========================================


const TARGET_URL =
"https://l-tike.com/concert/mevent/?mid=366800";


const TARGET_NAME =
"千葉";



async function main(){


    console.log(
        "ローチケ取得開始"
    );


    const res =
    await fetch(
        TARGET_URL,
        {
            headers:{
                "User-Agent":
                "Mozilla/5.0"
            }
        }
    );


    const html =
    await res.text();



    console.log(
        "HTML文字数:",
        html.length
    );



    // 千葉周辺を抽出

    const index =
    html.indexOf(
        TARGET_NAME
    );


    if(index === -1){

        console.log(
            "千葉が見つかりません"
        );

        return;

    }



    const area =
    html.substring(
        index - 2000,
        index + 30000
    );



    console.log(
        "===== 千葉周辺 ====="
    );


    console.log(
        area
    );



    console.log(
        "===== 状態コード ====="
    );


    const codes = [

        "NOW_SALE",
        "SOLDOUT",
        "FINISH",
        "BEFORE_SALE"

    ];



    for(
        const code of codes
    ){

        console.log(
            code,
            area.includes(code)
        );

    }



}



main();
