/* eslint-disable no-undef */
const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { OK, BadRequest, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;
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
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Your otp is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`,
    };

    await transporter.sendMail(mailOptions);
    return true;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    throw new Error('Failed to send verification mail');
  }
};

//securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }
};

const getForgetPass = async (req, res) => {
  try {
    res.render("admin-forgot-password");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageError");
  }
};

const forgotPassValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVeificationMail(email, otp);

      if (emailSent) {
        req.session.otp = otp;
        req.session.email = email;
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
    return res
      .status(InternalServerError)
      .json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const forgetPassOtpPage = async (req, res) => {
  try {
    res.render("admin-forgotPassOtp");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageError");
  }
};

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.otp) {
      res.json({ success: true, redirectUrl: "/admin/reset-password" });
    } else {
      res.status(BadRequest).json({ success: false, message: "OTP doesn't match" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const resendForgetPassOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.otp = otp;
    const email = req.session.email;
    const emailSent = await sendVeificationMail(email, otp);

    if (emailSent) {
      res
        .status(OK)
        .json({ success: true, message: "OTP Resent Successfully" });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const resetPasswordLoad = async (req, res) => {
  try {
    res.render("admin-reset-password");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageError");
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
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageError");
  }
};

module.exports = {
  getForgetPass,
  forgetPassOtpPage,
  forgotPassValid,
  verifyForgetPassOtp,
  resendForgetPassOtp,
  resetPasswordLoad,
  resetPassword,
};
