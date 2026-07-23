const https = require("https");

const url =
  "https://l-tike.com/concert/mevent/?mid=366800";


function fetchPage() {

  return new Promise((resolve, reject) => {


    console.log("ローチケ取得開始");


    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":
            "ja-JP,ja;q=0.9"
        }
      },

      (res) => {


        console.log(
          "Status:",
          res.statusCode
        );


        let html = "";


        res.on(
          "data",
          (chunk) => {
            html += chunk;
          }
        );


        res.on(
          "end",
          () => {

            resolve(html);

          }
        );


      }
    );


    req.setTimeout(
      30000,
      () => {

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
      (err) => {

        reject(err);

      }
    );


  });

}



async function main() {


  try {


    const html =
      await fetchPage();


    console.log(
      "取得成功"
    );


    console.log(
      "文字数:",
      html.length
    );



    const targets = [
      "千葉県",
      "ＬａＬａ",
      "LaLa",
      "TOKYO",
      "arena"
    ];



    for(
      const target of targets
    ) {


      console.log(
        "\n===================="
      );


      console.log(
        "検索:",
        target
      );


      const index =
        html.indexOf(target);



      console.log(
        "位置:",
        index
      );



      if(index !== -1) {


        console.log(
          html.substring(
            Math.max(0,index-800),
            index+1500
          )
        );


      } else {


        console.log(
          "見つかりません"
        );


      }


    }


  }
  catch(error) {


    console.log(
      "取得エラー:"
    );


    console.log(
      error.message
    );


  }


}



main();
