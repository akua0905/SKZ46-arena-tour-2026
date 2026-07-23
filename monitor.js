const https = require("https");

const urls = [
  "https://l-tike.com/",
  "https://l-tike.com/concert/mevent/?mid=366800"
];


function test(url){

return new Promise((resolve)=>{


console.log("");
console.log("====================");
console.log("接続テスト:");
console.log(url);



const req = https.get(

url,

{
headers:{

"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

"Accept":
"text/html,application/xhtml+xml",

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


console.log(
"取得文字数:",
html.length
);


console.log(
"取得成功"
);


resolve();


}

);


}

);



req.setTimeout(

30000,

()=>{

req.destroy();

console.log(
"30秒タイムアウト"
);

resolve();

}

);



req.on(
"error",
e=>{

console.log(
"エラー:",
e.message
);


resolve();

}

);


});

}



async function main(){


console.log(
"ローチケ接続テスト開始"
);



for(
const url of urls
){

await test(url);

}



console.log(
"テスト終了"
);


}



main();
