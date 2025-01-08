/*------------------
    forgot password
--------------------*/

let countdown = 60;
let timerInterval;

// Start the countdown timer
function startTimer() {
  timerInterval = setInterval(function () {
    countdown--;

    if (countdown < 0) {
      clearInterval(timerInterval);
      document.getElementById("timer").innerText = "00:00";
      document.getElementById("resend-otp").style.pointerEvents = "auto";
      document.getElementById("resend-otp").style.color = "#6BD1FF";
      return;
    }

    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    document.getElementById("timer").innerText = `00:${
      seconds < 10 ? "0" + seconds : seconds
    }`;
  }, 1000);
}

function resendOtp() {
  clearInterval(timerInterval);
  countdown = 60;
  document.getElementById("timer").classList.remove("expired");
  startTimer();

  const otpInputs = document.querySelectorAll(".otp-input");
  otpInputs.forEach((input) => (input.value = ""));

  $.ajax({
    type: "POST",
    url: "/resend-forgot-otp",
    success: function (response) {
      if (response.success) {
        Swal.fire({
          icon: "success",
          title: "OTP Resent Successfully",
          showConfirmButton: false,
          timer: 1500,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "An error occurred while resending OTP. Please try again.",
        });
      }
    },
    error: function () {
      Swal.fire({
        icon: "error",
        title: "Request Failed",
        text: "There was an issue connecting to the server. Please try again.",
      });
    },
  });

  return false;
}

// Move focus to next input box after entering OTP
function moveFocus(event, nextInputIndex) {
  if (event.target.value.length === 1) {
    const nextInput = document.querySelectorAll(".otp-input")[nextInputIndex];
    if (nextInput) {
      nextInput.focus();
    }
  }
}

function validateOTPForm(event) {
  event.preventDefault();

  // Collect the OTP values from the form
  const otpValues = [
    document.querySelector('input[name="otp1"]').value,
    document.querySelector('input[name="otp2"]').value,
    document.querySelector('input[name="otp3"]').value,
    document.querySelector('input[name="otp4"]').value,
    document.querySelector('input[name="otp5"]').value,
    document.querySelector('input[name="otp6"]').value,
  ];

  const otpString = otpValues.join("");
  console.log(otpString);

  if (otpValues.some((val) => val === "")) {
    Swal.fire({
      icon: "error",
      title: "Please enter all digits",
      text: "You must fill in all OTP fields.",
    });
    return false;
  }

  $.ajax({
    type: "POST",
    url: "/verify-forgotPassOtp",
    data: { otp: otpString },
    success: function (response) {
      if (response.success) {
        Swal.fire({
          icon: "success",
          title: "OTP verified successfully",
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          window.location.href = response.redirectUrl;
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Invalid OTP",
          text: response.message,
        });
      }
    },
    error: function () {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to verify OTP, please try again",
      });
    },
  });

  return false;
}

window.onload = startTimer;

/*------------------
    product details
--------------------*/

// Change main image on thumbnail click
document.querySelectorAll(".thumbnail").forEach((thumb) => {
  thumb.addEventListener("click", (e) => {
    const mainImage = document.getElementById("main-image");
    const newImageSrc = e.target.getAttribute("data-image");
    mainImage.src = newImageSrc;
    mainImage.setAttribute("data-zoom-image", newImageSrc);
  });
});

// document.addEventListener('DOMContentLoaded', function() {
//   // Dynamically set availableQuantity to product quantity passed from the backend
//   let availableQuantity = '<%= quantity %>';

//   const decreaseBtn = document.getElementById('decrease-quantity');
//   const increaseBtn = document.getElementById('increase-quantity');
//   const quantityInput = document.getElementById('quantity');

//   // Initialize quantity input to 1 (minimum quantity)
//   quantityInput.value = 1;

//   // Decrease quantity functionality
//   decreaseBtn.addEventListener('click', function() {
//       let currentQuantity = parseInt(quantityInput.value);

//       // Decrease only if the current quantity is greater than 1
//       if (currentQuantity > 1) {
//           quantityInput.value = currentQuantity - 1;
//       }
//   });

//   // Increase quantity functionality
//   increaseBtn.addEventListener('click', function() {
//       let currentQuantity = parseInt(quantityInput.value);

//       // Increase only if the current quantity is less than available stock
//       if (currentQuantity < availableQuantity) {
//           quantityInput.value = currentQuantity + 1;
//       }
//   });
// });

// Open the modal when the "Leave a Review" button is clicked
document
  .getElementById("leave-review-btn")
  .addEventListener("click", function () {
    var reviewModal = new bootstrap.Modal(
      document.getElementById("reviewModal")
    );
    reviewModal.show();
  });

document
  .getElementById("submitReviewBtn")
  .addEventListener("click", function (e) {
    var form = document.getElementById("reviewForm");
    e.preventDefault();
  });

document
  .getElementById("submitReviewBtn")
  .addEventListener("click", function (e) {
    const hasPurchased = false; // Assuming this variable is passed from the backend

    if (!hasPurchased) {
      // Show modal if the user hasn't purchased the product
      const modal = new bootstrap.Modal(
        document.getElementById("purchaseAlertModal")
      );
      modal.show();
    } else {
      // If purchased, submit the review form
      document.getElementById("reviewForm").submit();
    }
  });
