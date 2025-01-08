const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
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
    console.error("Error in hashing");
  }
};

const getForgetPass = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("/pageNotFound");
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
        res.render("forgotPassOtp");
        console.log("OTP: ", otp);
      } else {
        res.json({
          success: false,
          message: "Failed to send OTP, please try again",
        });
      }
    } else {
      res.render("forgot-password", {
        message: "User with this email does not exists.",
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    // console.log('Received OTP:', otp);
    // console.log('Stored OTP in session:', req.session.otp);

    if (otp === req.session.otp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
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
    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;

    if (password === confirmPassword) {
      const passwordHash = await securePassword(password);

      await User.updateOne({ email: email }, { password: passwordHash });

      // Send JSON response indicating success
      res.json({ success: true, message: "Password reset successfully." });
    } else {
      res.json({ success: false, message: "Passwords don't match" });
    }
  } catch (error) {
    console.log('Error during password reset:', error);
    res.json({ success: false, message: 'An error occurred. Please try again.' });
  }
};


const loadUserProfile = async(req, res) => {
  try {
    const userId = req.session.user;
    
    // Check if userId exists in the session
    if (!userId) {
      return res.redirect('/login');
    }

    // Fetch user data from the User collection
    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res.redirect('/login'); // User not found, redirect to login
    }

    const section = req.query.section || 'dashboard';
    let content = {};

    // Fetch different sections of user data based on the section parameter
    if (section === 'addresses') {
      // Fetch user's addresses from the Address collection
      const addresses = await Address.find({ userId });
      // console.log("Fetched Addresses:", addresses); // Log the entire address object
      // Check the structure of the 'address' field
      if (addresses && addresses.length > 0) {
        addresses.forEach(address => {
          // console.log("Address Object:", address.address); // Log the nested 'address' array
        });
      }
      content = { addresses };
    } else if (section === 'orders') {
      // Fetch user's orders (optional, if you have this section)
      const orders = await Order.find({ userId });
      content = { orders };
    } else {
      // Default content for the dashboard (could be profile stats, etc.)
      content = { userProfile: true };
    }

    // Render the profile page with the fetched data
    res.render('profile', {
      user: userData, 
      ...content, 
      section, 
      currentPage: section
    });

  } catch (error) {
    console.error('Error loading user profile:', error);
    res.redirect('/pageNotFound');
  }
};

const loadChangeEmail = async(req, res) => {
  try {
    res.render('change-email', {user: req.session.user || null});
  } catch (error) {
    console.log('Error in changing email');
    res.redirect('/userProfile');  
  }
}

const changeEmail = async(req, res) => {
  try {
    
    const {currentEmail} = req.body;
    const userExists = await User.findOne({email: currentEmail});
    if (userExists) {
      const otp = generateOtp();
      const emailSent = await sendVeificationMail(currentEmail, otp);

      if(emailSent) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = currentEmail;
        res.render('change-email-otp', {user: req.session.user || null});
        console.log('Email sent: ', currentEmail);
        console.log('otp: ', otp);
      } else{
        cosnole.log('Email error')
      } 
    } else {
      res.render('change-email', {message: 'User with this mail doesn\'t exists'});
    }

  } catch (error) {
    console.log('error', error);
    res.redirect('/pageNotFound');
  }
}


const verifyEmailOtp = async (req, res) => {
  try {
    // Log full request body and session data for detailed inspection
    console.log('Request body:', req.body);
    console.log('Session userOtp:', req.session.userOtp);

    // Retrieve OTPs from request and session, trimming them to ensure no spaces
    const otp = req.body.otp ? req.body.otp.trim() : undefined;
    const sessionOtp = req.session.userOtp ? req.session.userOtp.trim() : undefined;

    console.log('Received OTP:', otp);
    console.log('Session OTP:', sessionOtp);

    console.log('Is OTP equal?', otp === sessionOtp);  // Direct comparison result


    // Check if both OTPs are present before proceeding
    if (!otp || !sessionOtp) {
      console.log('OTP or session OTP not found.');
      return res.render('change-email-otp', {
        message: "OTP not received or session expired",
        userData: req.session.userData,
      });
    }

    // Additional log to show that both OTPs are being compared
    if (otp === sessionOtp) {
      console.log('OTP match successful!');
      req.session.userData = req.body.userData;
      res.json({
        success: true,  // Send success flag
        message: 'OTP verified successfully',  // Optional message for the client
        redirectUrl: '/profile/new-email',  // Optionally send a redirect URL
      });
    } else {
      console.log('OTP mismatch!');
      res.json({
        success: false,  // Send failure flag
        message: 'OTP not matching',  // Send error message
      });
    }
    

  } catch (error) {
    console.error('Error:', error);
    res.redirect('/pageNotFound');
  }
};

const loadNewMail = async(req, res) => {
  try {
    res.render('new-email', {user: req.session.user || null});
  } catch (error) {
    console.log('Error in loading', error);
    res.redirect('/pageNotFound');
  }
}

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;

    // Check if the new email already exists in the database
    const existingUser = await User.findOne({ email: newEmail });
    
    if (existingUser) {
      // If email already exists, send a response with an error message
      return res.render('new-email', {
        message: 'This email is already in use. Please choose a different one.',
      });
    }

    // Update email if it doesn't already exist
    await User.findByIdAndUpdate(userId, { email: newEmail });

    // Redirect to the user profile page after successful update
    res.redirect('/userProfile');
  } catch (error) {
    console.log('Error in updating mail', error);
    res.redirect('/pageNotFound');
  }
};

const loadEmailPageforPassChange = async(req, res) => {
  try {
    res.render('change-pass', {user: req.session.user || null});
  } catch (error) {
    console.log('Error in loading', error);
    res.redirect('/pageNotFound');
  }
}

const changePassValid = async (req, res) => {
  try {
    const { newEmail } = req.body; // Assuming the email field in your form is called "newEmail"
    
    // Check if the email is already taken
    const userExists = await User.findOne({ email: newEmail });

    if (userExists) {
      // If email doesn't exist, generate OTP and send it
      const otp = generateOtp();
      const emailSent = await sendVeificationMail(newEmail, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.userData = { email: newEmail }; // Store email in session for OTP verification
        res.render('change-pass-otp', {user: req.session.user || null});  // Redirect to OTP page
        console.log('OTP sent:', otp);
      } else {
        res.json({ success: false, message: 'Failed to send OTP' });
      }
    }
  } catch (error) {
    console.log('Error in change password validation', error);
    res.redirect('/pageNotFound');
  }
};

const verifyChangePassOtp = async(req, res) => {
  try {
    
    const {otp} = req.body;
    if(otp === req.session.userOtp) {
      req.session.email = req.session.userData.email;
      res.json({success: true, redirectUrl: '/reset-password'});
    } else {
      res.json({success: false, message: 'OTP not matching'});
    }

  } catch (error) {
    res.status(500).json({success: false, message: 'An error occured, please try again'});
    console.log('Error', error);
  }
}

const loadAddAddress = async (req, res) => {
  try {

    const user = req.session.user;
    res.render('add-address', {user: user})

  } catch (error) {
    console.error("Error loading:", error);
    res.status(500).send("Error loading addresses");
  }
};

const addAddress = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const userId = req.session.user; // Get userId from session
    const userData = await User.findOne({ _id: userId }); // Find user from DB
    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Destructure required fields from req.body for the new address
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;


    // Check if all required fields for the new address are present
    if (!addressType || !name || !city || !state || !pincode || !phone || !altPhone) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    // Check if the address with the same pincode already exists for this user
    const addressExists = await Address.findOne({ 
      'address.pincode': pincode, 
      userId: userData._id 
    });

    if (addressExists) {
      return res.status(400).json({ success: false, message: 'This location address already exists' });
    }

    // Construct the new address object
    const newAddress = {
      addressType,
      name,
      city,
      landMark: landMark || '',  // Optional field, can be empty if not provided
      state,
      pincode,
      phone,
      altPhone
    };

    // Find the user's address document
    const userAddress = await Address.findOne({ userId: userData._id });

    if (!userAddress) {
      // If no existing address document, create a new one
      const newAddressDoc = new Address({
        userId: userData._id,
        address: [newAddress]
      });
      await newAddressDoc.save();
    } else {
      // If user has existing addresses, push the new one
      userAddress.address.push(newAddress);
      await userAddress.save();
    }

    // Respond with success
    res.status(200).json({ success: true, message: 'Address added successfully' });

  } catch (error) {
    console.error('Error in adding address:', error);
    res.status(500).json({ success: false, message: 'An error occurred, please try again.' });
  }
};



    
const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const user = req.session.user;

    // Check if user is logged in
    if (!user) {
      return res.redirect('/login'); // Or wherever the login page is
    }

    // Find the address by address ID
    const currAddress = await Address.findOne({
      'address._id': addressId
    });

    // console.log('current address: ', currAddress)

    if (!currAddress) {
      console.log('Address not found');
      return res.redirect('/pageNotFound');
    }

    // Find the specific address data
    const addressData = currAddress.address.find((item) => item._id.equals(addressId));

    if (!addressData) {
      console.log('Address data not found');
      return res.redirect('/pageNotFound');
    }

    // Render the edit address page
    res.render('edit-address', { address: addressData, user: user });

  } catch (error) {
    console.error('Error loading address:', error);
    res.redirect('/pageNotFound');
  }
};

const editAddress = async (req, res) => {
  try {
    const data = req.body;
    const addressId = req.query.id; // Getting the address ID from the query string
    const user = req.session.user;

    // Find the address to update
    const findAddress = await Address.findOne({'address._id': addressId});
    if (!findAddress) {
      console.log('Address not found');
      return res.status(404).json({success: false, message: 'Address not found'});
    }

    // Update the address
    const updated = await Address.updateOne(
      {'address._id': addressId},
      {$set: {
        'address.$': {
          _id: addressId,
          addressType: data.addressType,
          name: data.name,
          city: data.city,
          landmark: data.landmark,
          state: data.state,
          pincode: data.pincode,
          phone: data.phone,
          altPhone: data.altPhone
        }
      }}
    );

    updated ? console.log('Updated') : console.log('not updated');

    // Respond with a redirect instead of JSON
    res.json({success: true, message: 'Address updated successfully'});  // This should work fine with ajax

  } catch (error) {
    console.log('Error in editing address', error);
    res.status(500).json({success: false, message: 'An error occurred, please try again.' });
  }
}

const deleteAddress = async(req, res) => {
  try {
    const addressId = req.query.id; // Getting the address ID from the query string

    const findAddress = await Address.findOne({'address._id': addressId});
    if (!findAddress) {
      console.log('Address not found');
      return res.status(404).json({success: false, message: 'Address not found'});
    }

    await Address.updateOne(
      {'address._id': addressId},
      {$pull: {
        address: {
          _id: addressId
        }
      }}
    );
    
    // Respond with a success message
    res.json({success: true, message: 'Address deleted successfully'});
  } catch (error) {
    console.log('Error in deleting address', error);
    res.status(500).json({success: false, message: 'An error occurred, please try again.'});
  }
}


module.exports = {
  getForgetPass,
  forgotPassValid,
  verifyForgetPassOtp,
  resendForgetPassOtp,
  resetPasswordLoad,
  resetPassword,
  loadUserProfile,
  loadChangeEmail,
  changeEmail,
  verifyEmailOtp,
  loadNewMail,
  updateEmail,
  loadEmailPageforPassChange,
  changePassValid,
  verifyChangePassOtp,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
};
