
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
