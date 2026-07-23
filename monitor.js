const { chromium } = require("playwright");


async function main() {


const url =
"https://l-tike.com/concert/mevent/?mid=366800";


const webhook =
process.env.WEBHOOK;



const browser =
await chromium.launch({

  headless:true,

  args:[
    "--disable-http2",
    "--disable-blink-features=AutomationControlled"
  ]

});



const context =
await browser.newContext({

  userAgent:
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",


  locale:"ja-JP",


  viewport:{
    width:1280,
    height:900
  }


});



const page =
await context.newPage();



try{


console.log("アクセス開始");



let success=false;



for(let i=1;i<=3;i++){


try{


await page.goto(

url,

{

waitUntil:"commit",

timeout:60000

}

);



success=true;

break;


}

catch(e){


console.log(
"再試行",
i,
e.message
);


await page.waitForTimeout(5000);


}



}



if(!success){

throw new Error(
"3回アクセス失敗しました"
);

}



await page.waitForTimeout(5000);



const text =
await page
.locator("body")
.innerText();



console.log(
text.substring(0,500)
);



let status="不明";



if(
text.includes(
"Oh hello! Nice to see you."
)
){

status=
"Bot対策ページ";


}else{


const check=[

"発売中",

"受付中",

"予定枚数終了",

"SOLD OUT",

"完売"

];



for(
const x of check
){

if(text.includes(x)){

status=x;

break;

}

}


}



console.log(
"結果:",
status
);



await sendDiscord(
webhook,
"🎫 ローチケ監視\n\n"
+
status
+
"\n\n"
+
url
);



}

catch(e){


console.log(e.message);


await sendDiscord(

webhook,

"❌ ローチケ監視エラー\n\n"
+
e.message

);


}



await browser.close();


}





async function sendDiscord(
webhook,
message
){


if(!webhook)return;



await fetch(

webhook,

{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify({

content:message

})

}

);


}



main();
