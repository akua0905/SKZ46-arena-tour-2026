const url =
"https://l-tike.com/concert/mevent/?mid=366800";


async function main(){

try{

console.log("取得開始");


const controller =
new AbortController();


const timer =
setTimeout(
()=>controller.abort(),
30000
);


const res =
await fetch(
url,
{
signal:controller.signal,
headers:{
"User-Agent":
"Mozilla/5.0"
}
}
);


clearTimeout(timer);


console.log(
"Status:",
res.status
);


const html =
await res.text();


console.log(
"取得成功"
);


console.log(
"文字数:",
html.length
);


console.log(
html.substring(0,500)
);


}catch(e){

console.log(
"エラー:",
e.message
);

}

}


main();
