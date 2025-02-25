/* eslint-disable no-undef */
/*------------------
     ADMIN SCRIPTS
--------------------*/

/*------------------
     Add Category
    --------------------*/

$(document).ready(function () {
  $("#categoryForm").submit(function (event) {
    event.preventDefault();

    const formData = $(this).serialize();

    $.ajax({
      type: "POST",
      url: "/admin/add-category",
      data: formData,
      success: function (response) {
        if (response.success) {
          Swal.fire({
            icon: "success",
            title: response.message,
            showConfirmButton: false,
            timer: 1500,
          }).then(function () {
            window.location.href = "/admin/categories";
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.message,
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
  });
});

/*------------------
    Add Coupon
--------------------*/



/*------------------
    Add Product
--------------------*/



/*---------------------
    Admin forgot pass
-----------------------*/



/*------------------
    Admin Login
--------------------*/

const emailId = document.getElementById("email");
const passId = document.getElementById("password");
const emailErr = document.getElementById("email-error");
const passErr = document.getElementById("password-error");
const form = document.getElementById("signup-form");

function showError(element, message) {
  element.style.display = "block";
  element.innerHTML = message;
}

function hideError(element) {
  element.style.display = "none";
  element.innerHTML = "";
}

function emailValidaterChecking() {
  const emailVal = emailId.value;
  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

  if (!emailPattern.test(emailVal)) {
    showError(emailErr, "Invalid format");
  } else {
    hideError(emailErr);
  }
}

function passValidaterChecking() {
  const passVal = passId.value;
  const alpha = /^[A-Za-z]/;
  const digit = /\d/;

  if (passVal.length < 8) {
    showError(passErr, "Should contain at least 8 characters");
  } else if (!alpha.test(passVal) || !digit.test(passVal)) {
    showError(passErr, "Should contain numbers and alphabets");
  } else {
    hideError(passErr);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    console.log("Form submit triggered");

    emailValidaterChecking();
    passValidaterChecking();

    if (emailErr.innerHTML || passErr.innerHTML) {
      return;
    }

    form.submit();
  });

  if (!emailId || !passErr || !form) {
    console.log("One or more elements not found");
  }
});


