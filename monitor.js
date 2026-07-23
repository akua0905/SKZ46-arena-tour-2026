const https = require("https");


const url =
"https://l-tike.com/concert/mevent/?mid=366800";


const options = {

  headers: {

    "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

    "Accept":
    "text/html,application/xhtml+xml",

    "Accept-Language":
    "ja,en-US;q=0.9"

  }

};



console.log("HTTPS接続開始");



const req = https.get(

  url,

  options,

  (res)=>{


    console.log(
      "Status:",
      res.statusCode
    );


    let body = "";


    res.on(
      "data",
      (chunk)=>{

        body += chunk;

      }
    );


    res.on(
      "end",
      ()=>{


        console.log(
          "取得文字数:",
          body.length
        );


        console.log(
          body.substring(0,500)
        );


      }
    );


  }

);



req.setTimeout(

  30000,

  ()=>{


    console.log(
      "30秒タイムアウト"
    );


    req.destroy();


  }

);



req.on(

  "error",

  (err)=>{


    console.log(
      "エラー:",
      err.message
    );


  }

);
