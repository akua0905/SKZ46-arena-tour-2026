const { chromium } = require("playwright");


async function main() {

  const url =
    "https://l-tike.com/concert/mevent/?mid=366800";


  const webhook =
    process.env.WEBHOOK;


  const browser =
    await chromium.launch({
      headless: true
    });


  const context =
    await browser.newContext({

      userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",

      locale:"ja-JP",

      viewport:{
        width:1280,
        height:900
      }

    });



  const page =
    await context.newPage();



  try {


    console.log("ページ取得開始");



    await page.goto(
      url,
      {
        waitUntil:"domcontentloaded",
        timeout:60000
      }
    );



    await page.waitForTimeout(3000);



    const title =
      await page.title();



    const text =
      await page
      .locator("body")
      .innerText();



    console.log(
      "タイトル:",
      title
    );


    console.log(
      text.substring(0,500)
    );



    let status =
    "不明";



    // Bot対策ページ確認

    if(
      text.includes(
        "Oh hello! Nice to see you."
      )
    ){

      status =
      "Bot対策ページ検出";


    }else{


      const words=[

        "発売中",

        "受付中",

        "予定枚数終了",

        "SOLD OUT",

        "完売",

        "残席あり"

      ];



      for(
        const word of words
      ){

        if(
          text.includes(word)
        ){

          status=word;

          break;

        }

      }


    }



    console.log(
      "判定:",
      status
    );



    if(webhook){


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

            content:
            "🎫 ローチケ監視結果\n\n"
            +
            status
            +
            "\n\n"
            +
            url

          })

        }
      );


    }



  }
  catch(error){


    console.log(
      "エラー:",
      error.message
    );



    if(webhook){


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

            content:
            "❌ ローチケ監視エラー\n\n"
            +
            error.message

          })

        }
      );


    }



  }
  finally{


    await browser.close();


  }


}


main();
