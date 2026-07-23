const https = require("https");

const url =
  "https://l-tike.com/concert/mevent/?mid=366800";


// ==============================
// HTML取得（3回リトライ）
// ==============================

function fetchPage(attempt = 1) {

  return new Promise((resolve, reject) => {


    console.log(
      `取得試行 ${attempt}/3`
    );


    const req = https.get(

      url,

      {
        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

          "Accept":
            "text/html,application/xhtml+xml",

          "Accept-Language":
            "ja-JP,ja;q=0.9"

        }
      },


      (res) => {


        console.log(
          "Status:",
          res.statusCode
        );


        let html = "";


        res.on(
          "data",
          chunk => {

            html += chunk;

          }
        );


        res.on(
          "end",
          () => {

            if(html.length > 10000){

              resolve(html);

            }
            else{

              reject(
                new Error(
                  "HTML取得量不足"
                )
              );

            }

          }
        );


      }


    );


    req.setTimeout(

      30000,

      () => {

        req.destroy();

        reject(
          new Error(
            "30秒タイムアウト"
          )
        );

      }

    );


    req.on(
      "error",
      reject
    );


  });


}



async function getHTML(){


for(
let i = 1;
i <= 3;
i++
){


try{


return await fetchPage(i);


}
catch(e){


console.log(
"失敗:",
e.message
);


if(i < 3){


console.log(
"5秒待機..."
);


await new Promise(
r=>setTimeout(r,5000)
);


}


}


}


throw new Error(
"3回取得失敗"
);


}



// ==============================
// JSON-LD抽出
// ==============================

function extractEvents(html){


const regex =
/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;


let match;

let result=[];


while(
(match = regex.exec(html))
){

try{


const data =
JSON.parse(match[1]);


if(Array.isArray(data)){

result.push(...data);

}
else{

result.push(data);

}


}
catch(e){}


}


return result;

}



// ==============================
// 状態判定
// ==============================

function getStatus(offer){


const now =
new Date();


const start =
offer.validFrom
?
new Date(offer.validFrom)
:
null;



if(
start &&
now < start
){

return "発売前";

}



if(
offer.availability &&
offer.availability.includes(
"SoldOut"
)
){

return "予定枚数終了";

}



if(
offer.availability &&
offer.availability.includes(
"InStock"
)
){

return "受付中";

}



return "不明";

}



// ==============================
// メイン
// ==============================

async function main(){


try{


console.log(
"ローチケ監視開始"
);



const html =
await getHTML();



console.log(
"取得成功"
);


console.log(
"文字数:",
html.length
);



const events =
extractEvents(html);



console.log(
"イベント数:",
events.length
);



for(
const event of events
){


if(
event.location &&
event.location.address &&
event.location.address.addressRegion === "千葉県"
){


console.log(
"\n===================="
);


console.log(
"会場:",
event.location.name
);


console.log(
"日程:",
event.startDate,
"〜",
event.endDate
);



for(
const offer of event.offers || []
){


console.log(
"状態:",
getStatus(offer)
);


console.log(
"availability:",
offer.availability
);


console.log(
"validFrom:",
offer.validFrom
);


}


}


}


}
catch(e){


console.log(
"エラー:",
e.message
);


}


}


main();
