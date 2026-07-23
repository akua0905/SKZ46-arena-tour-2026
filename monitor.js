const https = require("https");

https.get(
  "https://l-tike.com/",
  {
    headers:{
      "User-Agent":"Mozilla/5.0"
    }
  },
  res=>{

    console.log("Status:",res.statusCode);

    let data="";

    res.on("data",c=>{
      data+=c;
    });

    res.on("end",()=>{
      console.log("文字数:",data.length);
    });

  }
).on(
"error",
e=>{
 console.log("ERROR:",e.message);
});
