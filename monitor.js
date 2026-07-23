const { chromium } = require("playwright");


async function main() {

  const url =
    "https://l-tike.com/concert/mevent/?mid=366800";

  const webhook =
    process.env.WEBHOOK;


  const browser =
    await chromium.launch({

      headless: true,

      args: [
        "--disable-http2",
        "--disable-blink-features=AutomationControlled"
      ]

    });



  const context =
    await browser.newContext({

      userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",

      locale:
      "ja-JP",

      viewport:{
        width:1280,
        height:900
      }

    });



  const page =
    await context.newPage();



  let result = "";



  try {


    console.log(
      "アクセス開始"
    );


    let lastError = "";



    for(
      let i = 1;
      i <= 3;
      i++
    ){


      try {


        console.log(
          "試行:",
          i
        );


        await page.goto(

          url,

          {

            waitUntil:
            "domcontentloaded",

            timeout:
            30000

          }

        );


        lastError = "";

        break;


      } catch(e) {


        lastError =
        e.message;


        console.log(
          "失敗:",
          lastError
        );


        await page.waitForTimeout(
          3000
        );


      }

    }



    if(lastError){

      throw new Error(
        "3回アクセス失敗\n\n"
        +
        lastError
      );

    }



    await page.waitForTimeout(
      3000
    );



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
    "判定不可";



    if(
      text.includes(
        "Oh hello! Nice to see you."
      )
    ){

      status =
      "Bot対策ページ";


    }else{


      const words = [

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

          status =
          word;

          break;

        }

      }


    }



    result =
    "🎫 ローチケ監視結果\n\n"
    +
    status
    +
    "\n\n"
    +
    url;



  }
  catch(e){


    result =
    "❌ ローチケ監視エラー\n\n"
    +
    e.message;



    console.log(
      e.message
    );


  }



  await sendDiscord(
    webhook,
    result
  );



  await browser.close();


}



async function sendDiscord(
  webhook,
  message
){

  if(!webhook){
    return;
  }


  await fetch(

    webhook,

    {

      method:
      "POST",

      headers:{
        "Content-Type":
        "application/json"
      },

      body:
      JSON.stringify({

        content:
        message

      })

    }

  );

}



main();
