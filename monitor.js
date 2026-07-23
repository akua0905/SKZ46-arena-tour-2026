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


const target =
"予定枚数終了";


let index =
body.indexOf(target);



console.log(
"位置:",
index
);



if(index !== -1){

console.log(
body.substring(
index - 500,
index + 500
)
);

}else{

console.log(
"見つかりません"
);

}


});

});
