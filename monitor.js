const https = require("https");

const url =
"https://l-tike.com/concert/mevent/?mid=366800";


function getPage(){

return new Promise((resolve,reject)=>{


const req = https.get(

url,

{
headers:{

"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

"Accept-Language":
"ja,en-US;q=0.9,en;q=0.8"

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
html+=chunk;
}
);


res.on(
"end",
()=>{
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

});


req.on(
"error",
reject
);


});

}



async function main(){

try{


console.log(
"取得開始"
);


const html =
await getPage();


console.log(
"取得成功"
);


console.log(
"文字数:",
html.length
);



for(
const word of [
"千葉県",
"ＬａＬａ",
"TOKYO",
"arena"
]
){

const index =
html.indexOf(word);


console.log(
word,
index
);


if(index !== -1){

console.log(
html.substring(
index-500,
index+1000
)
);

}


}


}catch(e){

console.log(
"エラー:",
e.message
);

}

}


main();
