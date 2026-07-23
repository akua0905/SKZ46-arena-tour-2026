const { chromium } = require("playwright");


async function main() {

  const browser =
    await chromium.launch({
      headless: true
    });


  const page =
    await browser.newPage();


  let message = "";


  try {

    console.log("接続テスト開始");


    await page.goto(
      "https://www.google.com",
      {
        waitUntil: "commit",
        timeout: 30000
      }
    );


    const title =
      await page.title();


    console.log(
      "タイトル:",
      title
    );


    message =
      "✅ 接続テスト成功\n\n"
      +
      "タイトル:\n"
      +
      title;


  }
  catch(error) {


    console.log(
      "エラー:",
      error.message
    );


    message =
      "❌ 接続テスト失敗\n\n"
      +
      error.message;


  }



  console.log(message);


  await browser.close();


}


main();
