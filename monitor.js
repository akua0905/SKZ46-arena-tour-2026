const { chromium } = require("playwright");


async function main(){

const browser =
await chromium.launch({
  headless:true
});


const page =
await browser.newPage();


try{


console.log("ローチケ接続開始");


const response =
await page.goto(

"https://l-tike.com",

{

waitUntil:"commit",

timeout:30000

}

);



console.log(
"トップページ接続成功"
);


console.log(
"status:",
response.status()
);



await page.waitForTimeout(3000);



console.log(
"タイトル:",
await page.title()
);



}
catch(e){


console.log(
"ローチケ接続失敗"
);


console.log(
e.message
);


}



await browser.close();


}


main();
