const https = require("https");

const url =
"https://l-tike.com/concert/mevent/?mid=366800";


https.get(
url,
{
headers:{
"User-Agent":"Mozilla/5.0"
}
},
(res)=>{

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


const words=[
"千葉県",
"ＬａＬａ",
"TOKYO",
"arena"
];


for(
const word of words
){

let index =
html.indexOf(word);


console.log(
"\n================"
);

console.log(
word,
"位置:",
index
);


if(index !== -1){

console.log(
html.substring(
index-1000,
index+1500
)
);

}

}


});


});
