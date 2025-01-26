// eslint-disable-next-line no-undef
const express = require("express");
// eslint-disable-next-line no-undef, no-unused-vars
const env = require("dotenv").config();
// eslint-disable-next-line no-undef
const path = require("path");
// eslint-disable-next-line no-undef
const session = require("express-session");
// eslint-disable-next-line no-undef
const flash = require('connect-flash');

// custom
// eslint-disable-next-line no-undef
const db = require("./config/db");
// eslint-disable-next-line no-undef
const userRoute = require("./routes/userRouter");
// eslint-disable-next-line no-undef
const adminRoute = require("./routes/adminRouter");
// eslint-disable-next-line no-undef
const passport = require("./config/passport");

db();
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Session middleware (must be before flash middleware)
app.use(
  session({
    // eslint-disable-next-line no-undef
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,  // Should be true if using HTTPS in production
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000, // 72 hours
    },
  })
);

// Flash middleware (after session middleware)
app.use(flash());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Prevent caching
app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

// Set view engine and static files
app.set("view engine", "ejs");
app.set("views", [
  // eslint-disable-next-line no-undef
  path.join(__dirname, "views/user"),
  // eslint-disable-next-line no-undef
  path.join(__dirname, "views/admin"),
]);
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", userRoute);
app.use("/admin", adminRoute);

// Start server
// eslint-disable-next-line no-undef
app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-undef
  console.log(`Server listening to port ${process.env.PORT}`);
});

// eslint-disable-next-line no-undef
module.exports = app;
