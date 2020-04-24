var mongoose = require("mongoose");

var appreciationSchema = mongoose.Schema({
    date: {type: Date, default: Date.now},
    text: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        },
        username: String
    }
});

module.exports = mongoose.model("appreciation", appreciationSchema);
