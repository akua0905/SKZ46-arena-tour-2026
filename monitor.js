const https = require("https");
const fs = require("fs");

const URL =
  "https://l-tike.com/concert/mevent/?mid=366800";

const STATE_FILE =
  "state.json";

const DISCORD_WEBHOOK =
  process.env.DISCORD_WEBHOOK;


// ==========================
// ローチケ取得
// ==========================

function fetchPage(){

return new Promise((resolve,reject)=>{


const req = https.get(

URL,

{
headers:{
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
"Accept-Language":
"ja-JP,ja;q=0.9"
}
},


(res)=>{


console.log(
"Status:",
res.statusCode
);


let html="";


res.on(
"data",
chunk=>{
html += chunk;
}
);


res.on(
"end",
()=>{


if(html.length < 10000){

reject(
new Error(
"HTML取得量不足"
)
);

return;

}


resolve(html);


}
);


}

);



req.setTimeout(
30000,
()=>{

req.destroy();

reject(
new Error(
"timeout"
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



// ==========================
// リトライ取得
// ==========================

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


return await fetchPage();


}
catch(e){


console.log(
"取得失敗:",
e.message
);



if(i<3){

console.log(
"5秒待機"
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



// ==========================
// JSON-LD解析
// ==========================

function extractEvents(html){


const regex =
/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;


let match;

let events=[];



while(
(match=regex.exec(html))
){

try{


const data =
JSON.parse(match[1]);


if(Array.isArray(data)){

events.push(...data);

}else{

events.push(data);

}


}catch(e){}



}


return events;

}



// ==========================
// ステータス判定
// ==========================

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



// ==========================
// Discord通知
// ==========================

async function sendDiscord(text){


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
"Content-Type":
"application/json"
},

body:JSON.stringify({

content:text

})

}

);


}



// ==========================
// メイン
// ==========================

async function main(){


try{


console.log(
"監視開始"
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



let current={};



for(
const event of events
){



if(
event.location &&
event.location.address &&
event.location.address.addressRegion==="千葉県" &&
event.location.name.includes("ＬａＬａ")
){



let no=1;


for(
const offer of event.offers || []
){


current[
`LaLa_${no}`
]
=
getStatus(offer);


no++;


}



}


}



console.log(
current
);



let old={};



if(
fs.existsSync(STATE_FILE)
){

old =
JSON.parse(
fs.readFileSync(
STATE_FILE,
"utf8"
)
);

}



fs.writeFileSync(

STATE_FILE,

JSON.stringify(
current,
null,
2
)

);



for(
const key of Object.keys(current)
){


if(
old[key] &&
old[key] !== current[key]
){



const message =
`
🎫 櫻坂46 千葉公演 状態変更

会場:
ＬａＬａ arena TOKYO-BAY

枠:
${key}

${old[key]}
↓
${current[key]}

確認してください
`;



console.log(
message
);



await sendDiscord(
message
);



}


}



console.log(
"完了"
);



}
catch(e){


console.log(
"エラー:",
e.message
);


}


}



main();
