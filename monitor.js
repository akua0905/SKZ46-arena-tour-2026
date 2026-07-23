const https = require("https");

const url =
"https://l-tike.com/concert/mevent/?mid=366800";


const req = https.get(
  url,
  {
    headers:{
      "User-Agent":"Mozilla/5.0",
      "Connection":"close"
    }
  },
  (res)=>{

    console.log("Status:", res.statusCode);

    let html="";

    res.on("data", chunk=>{
      html += chunk;
    });

    res.on("end", ()=>{

      console.log("取得完了");
      console.log("文字数:", html.length);

      const words=[
        "千葉県",
        "ＬａＬａ",
        "TOKYO",
        "arena"
      ];

      for(const word of words){

        const index =
          html.indexOf(word);

        console.log(
          word,
          "位置:",
          index
        );

        if(index !== -1){

          console.log(
            html.substring(
              index-500,
              index+1000
            )
          );

        }

      }

    });

  }
);


req.setTimeout(
30000,
()=>{

  console.log(
    "30秒タイムアウト"
  );

  req.destroy();

});


req.on(
"error",
(err)=>{

  console.log(
    "エラー:",
    err.message
  );

});
