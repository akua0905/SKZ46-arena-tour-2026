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
"受付中",
"予定枚数終了",
"受付終了",
"発売前"
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
index-300,
index+300
)
);

}


}


});


});
