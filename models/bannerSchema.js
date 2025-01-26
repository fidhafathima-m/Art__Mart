// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const bannerSchema = new Schema({
  image: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  decrption: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: true,
  },
});

const Banner = mongoose.model("Banner", bannerSchema);

// eslint-disable-next-line no-undef
module.exports = Banner;
