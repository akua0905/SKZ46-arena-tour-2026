const https = require("https");


const url =
"https://l-tike.com/concert/mevent/?mid=366800";


function fetchPage(){

  return new Promise((resolve,reject)=>{


    const req = https.get(

      url,

      {

        headers:{

          "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

          "Accept":
          "text/html,application/xhtml+xml",

          "Accept-Language":
          "ja,en-US;q=0.9"

        }

      },


      (res)=>{


        console.log(
          "Status:",
          res.statusCode
        );


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

            resolve(body);

          }
        );


      }

    );


    req.setTimeout(

      30000,

      ()=>{

        req.destroy(
          new Error(
            "Timeout"
          )
        );

      }

    );


    req.on(
      "error",
      err=>{

        reject(err);

      }

    );


  });

}



async function main(){


let html;


try{


html =
await fetchPage();


console.log(
"取得成功"
);


console.log(
"文字数:",
html.length
);



const words=[

"発売中",
"受付中",
"予定枚数終了",
"SOLD OUT",
"完売",
"チケット"

];


for(
const word of words
){


console.log(
word,
html.includes(word)
);


}



}catch(e){


console.log(
"取得失敗:",
e.message
);


}


}


main();
