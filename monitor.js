const https = require("https");

const url =
  "https://l-tike.com/concert/mevent/?mid=366800";


function getPage() {

  return new Promise((resolve, reject) => {

    console.log("ローチケ取得開始");


    const req = https.get(

      url,

      {
        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

          "Accept":
            "text/html,application/xhtml+xml",

          "Accept-Language":
            "ja-JP,ja;q=0.9",

          "Connection":
            "close"

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
      (error) => {

        reject(error);

      }
    );


  });

}



async function main() {


  try {


    const html =
      await getPage();


    console.log(
      "取得成功"
    );


    console.log(
      "文字数:",
      html.length
    );



    const words = [

      "受付中",
      "予定枚数終了",
      "受付終了",
      "発売前"

    ];



    for (
      const word of words
    ) {


      console.log(
        "\n================"
      );


      console.log(
        word
      );


      let index =
        html.indexOf(word);



      console.log(
        "位置:",
        index
      );



      if(index !== -1) {


        console.log(
          html.substring(
            Math.max(0,index - 500),
            index + 500
          )
        );


      }
      else {


        console.log(
          "見つかりません"
        );


      }


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
