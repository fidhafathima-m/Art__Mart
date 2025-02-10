// eslint-disable-next-line no-undef
const env = require("dotenv");
env.config();
// eslint-disable-next-line no-undef
const passport = require("passport");
// eslint-disable-next-line no-undef
const GoogleStrategy = require("passport-google-oauth20").Strategy;
// eslint-disable-next-line no-undef
const User = require("../models/userSchema");

// eslint-disable-next-line no-undef
console.log(process.env.NODE_ENV)

// Set the callback URL based on environment
// eslint-disable-next-line no-undef
const callbackURL = process.env.NODE_ENV === 'production'
  ? 'https://www.art-mart.shop/auth/google/callback'
  : 'http://localhost:3000/auth/google/callback';  


passport.use(
  new GoogleStrategy(
    {
      // eslint-disable-next-line no-undef
      clientID: process.env.GOOGLE_CLIENT_ID,
      // eslint-disable-next-line no-undef
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
       callbackURL: callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile); // Debug profile object
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          console.log("User found:", user); // Debug existing user
          return done(null, user);
        } else {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          await user.save();
          console.log("New user created:", user); // Debug new user
          return done(null, user);
        }
      } catch (error) {
        console.error("Error in GoogleStrategy:", error); // Debug errors
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user:", user._id); // Debug serialization
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      console.log("Deserializing user:", user); // Debug deserialization
      done(null, user);
    })
    .catch((err) => {
      console.error("Deserialization error:", err); // Debug errors
      done(err, null);
    });
});
// eslint-disable-next-line no-undef
module.exports = passport;
