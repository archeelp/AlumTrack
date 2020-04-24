var mongoose = require("mongoose");

var blogSchema = mongoose.Schema({
    date: {type: Date, default: Date.now},
    text: String,
    url:String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        },
        username: String
    }
});

module.exports = mongoose.model("blog", blogSchema);
