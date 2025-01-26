// eslint-disable-next-line no-undef
const env = require("dotenv");
env.config();
// eslint-disable-next-line no-undef
const passport = require("passport");
// eslint-disable-next-line no-undef
const GoogleStrategy = require("passport-google-oauth20").Strategy;
// eslint-disable-next-line no-undef
const User = require("../models/userSchema");

passport.use(
  new GoogleStrategy(
    {
      // eslint-disable-next-line no-undef
      clientID: process.env.GOOGLE_CLIENT_ID,
      // eslint-disable-next-line no-undef
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        } else {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          await user.save();
          return done(null, user);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

// eslint-disable-next-line no-undef
module.exports = passport;
