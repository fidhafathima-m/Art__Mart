// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");
// eslint-disable-next-line no-undef
const nodemailer = require("nodemailer");
// eslint-disable-next-line no-undef, no-unused-vars
const env = require("dotenv").config();
// eslint-disable-next-line no-undef
const bcrypt = require("bcrypt");

// generate OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// verification mail
const sendVeificationMail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        // eslint-disable-next-line no-undef
        user: process.env.NODEMAILER_EMAIL,
        // eslint-disable-next-line no-undef
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      // eslint-disable-next-line no-undef
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Your otp is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);
    return true;
  } catch (error) {
    console.log("Error sending mail", error);
    return false;
  }
};

//securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("Error in hashing", error);
  }
};

const getForgetPass = async (req, res) => {
  try {
    res.render("admin-forgot-password");
  } catch (error) {
    res.redirect("/pageError");
    console.log('Error', error);
  }
};

const forgotPassValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser  = await User.findOne({ email: email });

    if (findUser ) {
      const otp = generateOtp();
      const emailSent = await sendVeificationMail(email, otp);

      if (emailSent) {
        req.session.otp = otp;
        req.session.email = email;
        console.log("OTP: ", otp);
        return res.json({ success: true });
      } else {
        return res.json({
          success: false,
          message: "Failed to send OTP, please try again",
        });
      }
    } else {
      return res.json({
        success: false,
        message: "Admin with this email does not exist.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

const forgetPassOtpPage = async (req, res) => {
  try {
    res.render('admin-forgotPassOtp');
  } catch (error) {
    console.log('error: ', error);
    res.redirect('/pageError');
  }
}

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    // console.log('Received OTP:', otp);
    // console.log('Stored OTP in session:', req.session.otp);

    if (otp === req.session.otp) {
      res.json({ success: true, redirectUrl: "/admin/reset-password" });
    } else {
      res.status(400).json({ success: false, message: "OTP doesn't match" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occured." });
  }
};

const resendForgetPassOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.otp = otp;
    const email = req.session.email;
    console.log("Resending OTP to mail: ", email);
    const emailSent = sendVeificationMail(email, otp);

    if (emailSent) {
      console.log("Resent OTP: ", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP Resent Successfully" });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const resetPasswordLoad = async (req, res) => {
  try {
    res.render("admin-reset-password");
  } catch (error) {
    res.redirect("/pageError");
    console.log("Error: ", error);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;
    if (password === confirmPassword) {
      const passwordHashh = await securePassword(password);
      await User.updateOne({ email: email }, { password: passwordHashh });
      res.redirect("/admin/login");
    } else {
      res.render("admin-reset-password", {
        message: "Passwords doesn't match",
      });
    }
  } catch (error) {
    res.redirect("/pageError");
    console.log("Error: ", error);
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  getForgetPass,
  forgetPassOtpPage,
  forgotPassValid,
  verifyForgetPassOtp,
  resendForgetPassOtp,
  resetPasswordLoad,
  resetPassword,
};
