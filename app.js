/* eslint-disable no-undef */
const express = require("express");
require("dotenv").config();
const path = require("path");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");

// custom
const db = require("./config/db");
const userRoute = require("./routes/userRouter");
const adminRoute = require("./routes/adminRouter");
const passport = require("./config/passport");

db();
const app = express();

// Middleware
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Session middleware (must be before flash middleware)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
      sameSite: 'lax',
      domain: process.env.NODE_ENV === 'production' ? 'www.art-mart.shop' : undefined
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URL,
      ttl: 72 * 60 * 60, // = 72 hours
      autoRemove: 'native',
      touchAfter: 24 * 3600 // = 24 hours
    })
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
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", userRoute);
app.use("/admin", adminRoute);

// Start server
app.listen(process.env.PORT, () => {
  console.log(`Server listening to port ${process.env.PORT}`);
});

module.exports = app;
