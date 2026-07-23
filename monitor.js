const https = require("https");

const url =
"https://l-tike.com/concert/mevent/?mid=366800";


function request(){

return new Promise((resolve,reject)=>{


const req = https.get(

url,

{

headers:{

"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

"Accept":
"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

"Accept-Language":
"ja-JP,ja;q=0.9",

"Connection":
"close"

}

},

(res)=>{


console.log(
"Status:",
res.statusCode
);


let data="";


res.on(
"data",
chunk=>{
data += chunk;
}
);


res.on(
"end",
()=>{

resolve(data);

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



async function main(){


for(
let i=1;
i<=2;
i++
){


try{


console.log(
"試行:",
i
);


const html =
await request();


console.log(
"取得成功"
);


console.log(
"文字数:",
html.length
);



console.log(
"予定枚数終了:",
html.includes("予定枚数終了")
);



console.log(
"受付中:",
html.includes("受付中")
);



break;



}catch(e){


console.log(
"失敗:",
e.message
);



if(i===2){

console.log(
"2回失敗"
);

}

}


}


}


main();
