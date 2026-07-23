const https = require("https");

const url =
  "https://l-tike.com/concert/mevent/?mid=366800";


function fetchPage() {

  return new Promise((resolve, reject) => {

    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept-Language":
            "ja-JP,ja;q=0.9"
        }
      },

      (res) => {

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
            resolve(html);
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



function extractJsonLD(html) {

  const regex =
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;


  let match;

  let events = [];


  while(
    (match = regex.exec(html))
  ){

    try{

      const data =
        JSON.parse(match[1]);


      if(
        Array.isArray(data)
      ){

        events.push(...data);

      }
      else{

        events.push(data);

      }


    }
    catch(e){

    }

  }


  return events;

}



function convertStatus(offer) {


  const now =
    new Date();


  const start =
    offer.validFrom
      ? new Date(offer.validFrom)
      : null;



  if(
    start &&
    now < start
  ){

    return "発売前";

  }



  if(
    offer.availability &&
    offer.availability.includes("SoldOut")
  ){

    return "予定枚数終了";

  }



  if(
    offer.availability &&
    offer.availability.includes("InStock")
  ){

    return "受付中";

  }


  return "不明";

}



async function main(){


try{


console.log(
"取得開始"
);


const html =
await fetchPage();



console.log(
"HTML取得:",
html.length,
"文字"
);



const events =
extractJsonLD(html);



console.log(
"JSONイベント数:",
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
"販売状態:",
convertStatus(offer)
);


console.log(
"元データ:",
offer.availability
);


console.log(
"販売開始:",
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
