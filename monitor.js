const https = require("https");


const url =
"https://l-tike.com/concert/mevent/?mid=366800";


https.get(

url,

{
headers:{
"User-Agent":
"Mozilla/5.0"
}
},

(res)=>{


let body="";


res.on(
"data",
chunk=>{
body += chunk;
}
);


res.on(
"end",
()=>{


const words=[

"発売中",
"受付中",
"予定枚数終了",
"SOLD OUT",
"完売",
"残席"

];


console.log("確認結果");


for(
const word of words
){

console.log(
word,
body.includes(word)
);

}


}

);


}

);
