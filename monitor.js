const https = require("https");

const url =
  "https://l-tike.com/concert/mevent/?mid=366800";


function fetchLticket() {

  return new Promise((resolve, reject) => {

    console.log("ローチケ取得開始");

    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept-Language":
            "ja-JP,ja;q=0.9"
        }
      },
      (res) => {

        console.log(
          "HTTP Status:",
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
      (error) => {

        reject(error);

      }
    );


  });

}



async function main() {

  try {

    const html =
      await fetchLticket();


    console.log(
      "取得成功"
    );


    console.log(
      "文字数:",
      html.length
    );


    const keywords = [
      "発売中",
      "受付中",
      "予定枚数終了",
      "SOLD OUT",
      "完売"
    ];


    console.log(
      "状態確認"
    );


    for (
      const word of keywords
    ) {

      console.log(
        word + ":",
        html.includes(word)
      );

    }


  }
  catch(error) {

    console.log(
      "エラー:"
    );

    console.log(
      error.message
    );

  }

}


main();
