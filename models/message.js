var mongoose = require("mongoose");

var messageSchema = mongoose.Schema({
    date: {type: Date, default: Date.now},
    text : {type:String,default:"nothing here"},
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    to : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }
});

module.exports = mongoose.model("message", messageSchema);