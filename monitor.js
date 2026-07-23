const http = require("http");


const url =
"https://l-tike.com/concert/mevent/?mid=366800";


const options = {

  headers: {

    "User-Agent":
    "Mozilla/5.0",

    "Accept":
    "text/html,application/xhtml+xml"

  }

};



https.get(

url,

options,

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

console.log(
"取得文字数:",
body.length
);

console.log(
body.substring(0,300)
);

}

);


}

).on(

"error",

(err)=>{

console.log(
"Error:",
err.message
);

}

);
