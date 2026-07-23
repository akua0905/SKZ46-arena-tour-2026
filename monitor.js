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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",

          "Accept-Language":
          "ja,en-US;q=0.9,en;q=0.8"

        }
      },

      res=>{


        let data="";


        console.log(
          "Status:",
          res.statusCode
        );


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
            "30秒タイムアウト"
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


try{


console.log(
"HTTP取得開始"
);



const html =
await getPage();



console.log(
"取得文字数:",
html.length
);



console.log(
html.substring(0,500)
);



let result =
"❌ 判定不可";



if(
html.includes(
"予定枚数終了"
)
){

result =
"🎫 予定枚数終了";

}
else if(
html.includes(
"発売中"
)
){

result =
"🎫 発売中";

}
else{

result =
"🎫 ページ取得成功（状態確認不可）";

}



console.log(
result
);



}

catch(e){


console.log(
"エラー:"
);

console.log(
e.message
);


}



}


main();
