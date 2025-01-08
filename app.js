const express = require("express");
const env = require("dotenv").config();
const path = require("path");
const session = require("express-session");
const flash = require('connect-flash');

// custom
const db = require("./config/db");
const userRoute = require("./routes/userRouter");
const adminRoute = require("./routes/adminRouter");
const passport = require("./config/passport");

db();
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Session middleware (must be before flash middleware)
app.use(
  session({
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
