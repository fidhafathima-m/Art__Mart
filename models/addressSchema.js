// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  address: [
    {
      addressType: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      landMark: {
        type: String,
        required: false,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: Number,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      altPhone: {
        type: String,
        required: false,
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

addressSchema.index({ userId: 1 });
addressSchema.index({ "address.isDefault": 1 });

const Address = mongoose.model("Address", addressSchema);

// eslint-disable-next-line no-undef
module.exports = Address;
