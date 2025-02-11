// eslint-disable-next-line no-undef
const express = require("express");
// eslint-disable-next-line no-undef, no-unused-vars
const env = require("dotenv").config();
// eslint-disable-next-line no-undef
const path = require("path");
// eslint-disable-next-line no-undef
const session = require("express-session");
// eslint-disable-next-line no-undef
const flash = require("connect-flash");

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
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Session middleware (must be before flash middleware)
app.use(
  session({
    // eslint-disable-next-line no-undef
    secret: process.env.SESSION_SECRET,
    resave: true,  // Changed to true
    saveUninitialized: false,
    cookie: {
      secure: true,  // Since you're using HTTPS
      httpOnly: true,
      maxAge: 259200000,  // Matching your current cookie settings
      sameSite: 'lax',
      domain: '.art-mart.shop'  // Added dot prefix to work with subdomains
    },
    // store: MongoStore.create({
    //   mongoUrl: process.env.MONGODB_URL,
    //   ttl: 259200,  // Matching cookie maxAge in seconds
    //   autoRemove: 'native',
    //   touchAfter: 24 * 3600,
    //   stringify: false,  // Added this
    //   mongoOptions: {     // Added connection options
    //     useUnifiedTopology: true,
    //     serverSelectionTimeoutMS: 5000
    //   }
    // })
  })
);

// Add this middleware to log session data
app.use((req, res, next) => {
  const oldRedirect = res.redirect;
  res.redirect = function newRedirect(url) {
    console.log('Redirecting to:', url);
    console.log('Session state at redirect:', req.session);
    oldRedirect.apply(this, arguments);
  };
  next();
});



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
