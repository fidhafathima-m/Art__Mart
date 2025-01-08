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

$("#addCouponForm").submit(function (e) {
  var formData = {
    name: $("#name").val(),
    expireOn: $("#expireOn").val(),
    offerPrice: $("#offerPrice").val(),
    minPurchaseAmount: $("#minPurchaseAmount").val(),
  };

  if (
    !formData.name ||
    !formData.expireOn ||
    !formData.offerPrice ||
    !formData.minPurchaseAmount
  ) {
    Swal.fire({
      icon: "error",
      title: "All fields are required!",
      text: "Please fill in all the fields.",
    });
    return;
  }

  var expireDate = new Date(formData.expireOn);
  if (isNaN(expireDate)) {
    Swal.fire({
      icon: "error",
      title: "Invalid expiration date",
      text: "Please enter a valid expiration date.",
    });
    return;
  }

  $.ajax({
    type: "POST",
    url: "/admin/add-coupon",
    data: formData,
    success: function (response) {
      if (response.success) {
        Swal.fire({
          icon: "success",
          title: "Coupon Added",
          text: response.message || "The coupon has been added successfully.",
        }).then(() => {
          window.location.href = "/admin/coupons";
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: response.message || "There was an issue adding the coupon.",
        });
      }
    },
    error: function () {
      Swal.fire({
        icon: "error",
        title: "Server Error",
        text: "There was an issue connecting to the server.",
      });
    },
  });
});

/*------------------
    Add Product
--------------------*/



/*---------------------
    Admin forgot pass
-----------------------*/

let countdown = 60;
let timerInterval;

// Start the countdown timer
function startTimer() {
  timerInterval = setInterval(function () {
    countdown--;

    if (countdown < 0) {
      clearInterval(timerInterval);
      document.getElementById("timer").innerText = "00:00"; // Set timer to 00:00 when it reaches 0
      document.getElementById("resend-otp").style.pointerEvents = "auto";
      document.getElementById("resend-otp").style.color = "#6BD1FF";
      return; // Stop the countdown once it hits 0
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
    url: "/admin/resend-forgot-otp",
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

  // Ensure all OTP fields are filled
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
    url: "/admin/verify-forgotPassOtp",
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

/*------------------
    Categories
--------------------*/

function toggleListing(id, isListed) {
  const url = isListed ? "/admin/unlistCategory" : "/admin/listCategory";

  $.ajax({
    type: "GET",
    url: url,
    data: { id: id },
    success: function (response) {
      if (response.success) {
        Swal.fire({
          icon: "success",
          title: isListed ? "Category Listed" : "Category Unlisted",
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          location.reload();
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
}

function deleteCategory(categoryId) {
  Swal.fire({
    title: "Are you sure?",
    text: "This category will be soft deleted.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        type: "PATCH",
        url: `/admin/delete-category/${categoryId}`,
        success: function (response) {
          if (response.message === "Category soft deleted successfully") {
            Swal.fire({
              icon: "success",
              title: "Category deleted!",
              text: "The Category has been soft deleted.",
              showConfirmButton: false,
              timer: 1500,
            }).then(() => {
              location.reload();
            });
          }
        },
        error: function () {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "There was an error deleting the category.",
          });
        },
      });
    }
  });
}

function restoreCategory(categoryId) {
  Swal.fire({
    title: "Are you sure?",
    text: "This category will be restored.",
    icon: "info",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, restore it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        type: "PATCH",
        url: `/admin/restore-category/${categoryId}`,
        success: function (response) {
          if (response.message === "Category restored successfully") {
            Swal.fire({
              icon: "success",
              title: "Category Restored!",
              text: "The category has been successfully restored.",
              showConfirmButton: false,
              timer: 1500,
            }).then(() => {
              location.reload();
            });
          }
        },
        error: function () {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "There was an error restoring the cartegory.",
          });
        },
      });
    }
  });
}

/*------------------
        Coupons
--------------------*/


/*------------------
     Edit Product
--------------------*/

document.getElementById("add-highlight").addEventListener("click", function () {
  const newInput = document.createElement("input");
  newInput.type = "text";
  newInput.name = "highlights[]";
  newInput.className = "form-control mb-2";
  newInput.placeholder = "Enter highlight";

  document.getElementById("highlights-list").appendChild(newInput);
});

// Form Validation
function validateForm() {
  let isValid = true;

  // Check Product Name
  if (document.getElementById("productName").value.trim() === "") {
    document.getElementById("productName").classList.add("is-invalid");
    isValid = false;
  } else {
    document.getElementById("productName").classList.remove("is-invalid");
  }

  // Check Description
  if (document.getElementById("description").value.trim() === "") {
    document.getElementById("description").classList.add("is-invalid");
    isValid = false;
  } else {
    document.getElementById("description").classList.remove("is-invalid");
  }

  // Check Price
  if (document.getElementById("regularPrice").value <= 0) {
    document.getElementById("regularPrice").classList.add("is-invalid");
    isValid = false;
  } else {
    document.getElementById("regularPrice").classList.remove("is-invalid");
  }

  // if (document.getElementById('productOffer').value <= 0) {
  //     document.getElementById('productOffer').classList.add('is-invalid');
  //     isValid = false;
  // } else {
  //     document.getElementById('productOffer').classList.remove('is-invalid');
  // }

  // Check Quantity
  if (document.getElementById("quantity").value <= 0) {
    document.getElementById("quantity").classList.add("is-invalid");
    isValid = false;
  } else {
    document.getElementById("quantity").classList.remove("is-invalid");
  }

  // Check Images
  // if (!document.getElementById('image1').files[0] || !document.getElementById('image2').files[0] || !document.getElementById('image3').files[0]) {
  //     alert('Please upload all images.');
  //     isValid = false;
  // }

  return isValid;
}
function handleImageUpload(
  inputId,
  previewId,
  saveButtonId,
  croppedPreviewId,
  hiddenInputId
) {
  const inputElement = document.getElementById(inputId);
  const previewContainer = document.getElementById(previewId);
  const imageElement = document.getElementById(previewId + "-img");
  const saveButton = document.getElementById(saveButtonId);
  const croppedPreview = document.getElementById(croppedPreviewId);
  const hiddenInput = document.getElementById(hiddenInputId); // Hidden input for cropped image

  croppedPreview.style.display = "none";

  inputElement.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        imageElement.src = e.target.result;
        previewContainer.style.display = "block";

        // Initialize cropper without fixed aspect ratio for free cropping
        const cropper = new Cropper(imageElement, {
          viewMode: 1,
          responsive: true,
          rotatable: true,
          scalable: true,
        });

        saveButton.style.display = "inline-block";
        saveButton.onclick = function () {
          const croppedCanvas = cropper.getCroppedCanvas({
            width: imageElement.naturalWidth,
            height: imageElement.naturalHeight,
          });

          // Optional: Set image smoothing for better quality
          const ctx = croppedCanvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          croppedPreview.src = croppedCanvas.toDataURL("image/png"); // Save as PNG for better quality
          croppedPreview.style.display = "block";

          // Save the cropped image as base64 to the hidden input field
          hiddenInput.value = croppedCanvas.toDataURL("image/png"); // Use PNG for better quality (lossless)
        };
      };
      reader.readAsDataURL(file);
    }
  });
}

// Apply to each image with corresponding hidden input field for cropped image
handleImageUpload(
  "image1",
  "image1-preview",
  "saveImage1",
  "croppedImage1",
  "croppedImage1Data"
);
handleImageUpload(
  "image2",
  "image2-preview",
  "saveImage2",
  "croppedImage2",
  "croppedImage2Data"
);
handleImageUpload(
  "image3",
  "image3-preview",
  "saveImage3",
  "croppedImage3",
  "croppedImage3Data"
);

$(document).ready(function () {
  $(".delete-image").click(function () {
    const imageId = $(this).data("image-id");
    const productId = $(this).data("product-id");
    console.log("Delete image clicked", imageId, productId);
    deleteSingleImage(imageId, productId);
  });
});

function deleteSingleImage(imageId, productId) {
  console.log("Delete image clicked", imageId, productId); // For debugging

  $.ajax({
    url: "/admin/deleteImage",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      imageNameToServer: imageId,
      productIdToServer: productId,
    }),
    success: function (response) {
      if (response.status === true) {
        window.location.reload();
      } else {
        alert(response.message || "Error deleting image");
      }
    },
    error: function (xhr, status, error) {
      console.error("Error deleting image:", error);
      alert("An error occurred while deleting the image.");
    },
  });
}

$("#editProductForm").on("submit", function (e) {
  e.preventDefault();

  $.ajax({
    type: "POST",
    url: $(this).attr("action"),
    data: new FormData(this),
    processData: false,
    contentType: false,
    success: function (response) {
      if (response.success) {
        Swal.fire({
          icon: "success",
          title: "Product Updated",
          text: response.message,
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          window.location.href = "/admin/products";
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: response.message || "There was an error updating the product.",
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

/*------------------
     Products
--------------------*/

async function addOffer(productId) {
  const { value: amount } = await Swal.fire({
    title: "Offer in percentage",
    input: "number",
    inputLabel: "Enter Offer Percentage",
    inputPlaceholder: "%",
  });
  $.ajax({
    url: "/admin/addProductOffer",
    method: "POST",
    data: {
      percentage: amount,
      productId: productId,
    },
    success: (response) => {
      if (response.status === true) {
        Swal.fire("Offer Added", "The offer has been added", "success").then(
          () => {
            location.reload();
          }
        );
      } else {
        alert("failed");
      }
    },
  });
}

function removeOffer(productId) {
  try {
    Swal.fire({
      title: "Remove offer",
      text: "Are you sure to remove this offer?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, remove it!",
      timer: 5000,
      timerProgressBar: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/admin/removeProductOffer",
          method: "POST",
          data: {
            productId: productId,
          },
          success: (response) => {
            if (response.status === true) {
              Swal.fire(
                "Offer Removed",
                "The offer has been removed",
                "success"
              ).then(() => {
                location.reload();
              });
            } else if (response.success === false) {
              Swal.fire("failed");
            } else {
              alert("failed");
            }
          },
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
}

function deleteProduct(productId) {
  Swal.fire({
    title: "Are you sure?",
    text: "This product will be soft deleted.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        type: "PATCH",
        url: `/admin/delete-product/${productId}`,
        success: function (response) {
          if (response.message === "Product soft deleted successfully") {
            Swal.fire({
              icon: "success",
              title: "Product deleted!",
              text: "The product has been soft deleted.",
              showConfirmButton: false,
              timer: 1500,
            }).then(() => {
              location.reload();
            });
          }
        },
        error: function () {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "There was an error deleting the product.",
          });
        },
      });
    }
  });
}

function restoreProduct(productId) {
  Swal.fire({
    title: "Are you sure?",
    text: "This product will be restored.",
    icon: "info",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, restore it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        type: "PATCH",
        url: `/admin/restore-product/${productId}`,
        success: function (response) {
          if (response.message === "Product restored successfully") {
            Swal.fire({
              icon: "success",
              title: "Product Restored!",
              text: "The product has been successfully restored.",
              showConfirmButton: false,
              timer: 1500,
            }).then(() => {
              location.reload();
            });
          }
        },
        error: function () {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "There was an error restoring the product.",
          });
        },
      });
    }
  });
}
