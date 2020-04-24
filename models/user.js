var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
    signupdate: {type: Date, default: Date.now},
    username: String,
    password: String,
    address: String,
    image:{ type : String ,default:"https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcTkDM78IoAieoxU-s9Z2FqmT02Nv9IujYs8l199PVP68H94TEZd&usqp=CAU"},
    image_id: String,
    type: String,
    fname: String,
	lname: String,
    email: String,
    contactnumber: String,
	authenticationKey: String,
    description: String,
    address: String,
    institute:[
        {   
            name: String,
            branch: String,
            graduation_date : String,
            verified : {type:Boolean,default:false},
            id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "user"
            }
        }
    ],
    skills:[
        String
    ],
    profiles:[
        String
    ],
    loc:{
        x:String,
        y:String
    },
    appreciations: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "appreciation"
        }
    ],
    blogs: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "blog"
        }
    ],
    sent: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "user"
        }
    ],
    recieved: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "user"
        }
    ],
    accepted: [
        {
           type: mongoose.Schema.Types.ObjectId,
           ref: "user"
        }
    ]
});

userSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model("user", userSchema);