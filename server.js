const express = require("express");
const app = express();

// use dns prefetch control
// app.use(
//   require("helmet")({
//     dnsPrefetchControl: { allow: false },
//   })
// );

// logg set response headers
app.use(function (req, res, next) {
  console.log(res.getHeaders());
  next();
});

app.use("/", express.static("build"));

app.listen(process.env.PORT, function () {
  console.log("helmet-prefetch demo is up on port " + 8080);
});
