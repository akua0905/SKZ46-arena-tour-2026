const { chromium } = require("playwright");


(async()=>{


const browser =
await chromium.launch({
headless:true
});


const page =
await browser.newPage();


await page.goto(
"https://l-tike.com/concert/mevent/?mid=366800",
{
waitUntil:"networkidle",
timeout:60000
}
);


const text =
await page.locator("body").innerText();


let status="不明";


const list=[
"発売中",
"受付中",
"予定枚数終了",
"SOLD OUT",
"完売"
];


for(const x of list){

 if(text.includes(x)){

  status=x;
  break;

 }

}


console.log(status);



await fetch(
process.env.WEBHOOK,
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

content:
"🎫 ローチケ確認\n"
+status

})

}
);



await browser.close();


})();
