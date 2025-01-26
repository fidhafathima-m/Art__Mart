/* eslint-disable no-undef */
/*------------------
     ADMIN SCRIPTS
--------------------*/

/*------------------
     Add Category
    --------------------*/

// eslint-disable-next-line no-undef
$(document).ready(function () {
  // eslint-disable-next-line no-undef
  $("#categoryForm").submit(function (event) {
    event.preventDefault();

    const formData = $(this).serialize();

    // eslint-disable-next-line no-undef
    $.ajax({
      type: "POST",
      url: "/admin/add-category",
      data: formData,
      success: function (response) {
        if (response.success) {
          // eslint-disable-next-line no-undef
          Swal.fire({
            icon: "success",
            title: response.message,
            showConfirmButton: false,
            timer: 1500,
          }).then(function () {
            window.location.href = "/admin/categories";
          });
        } else {
          // eslint-disable-next-line no-undef
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.message,
          });
        }
      },
      error: function () {
        // eslint-disable-next-line no-undef
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

/*------------------
    Categories
--------------------*/


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
// eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-undef
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

