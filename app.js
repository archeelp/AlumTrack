//SETUP AND IMPORTS
require('isomorphic-fetch');
require('isomorphic-form-data');
var express					= require("express"),
    app 					= express(),
	bodyParser 				= require("body-parser"),
	session 				= require("express-session"),
	mongoose 				= require("mongoose"),
	expressSanitizer 		= require("express-sanitizer"),
	passport 				= require("passport"),
	LocalStrategy 			= require("passport-local"),
	passportLocalMongoose 	= require("passport-local-mongoose"),
	user 				  	= require("./models/user"),
	appreciation 			= require("./models/appreciation"),
	feedback                = require("./models/feedback"),
	message 				= require("./models/message"),
	blog					= require("./models/blog"),
	faker 					= require("faker"),
	flash       			= require("connect-flash"),
	databaseURL 			= 'mongodb://localhost/alumtrack';
	arcgisRestGeocoding = require('@esri/arcgis-rest-geocoding'),
	{ geocode } = arcgisRestGeocoding,
	client = require('socket.io').listen(4000).sockets,
	people = {},
	secret=process.env.SECRET||"We are Alumtrack developers";


mongoose.connect(databaseURL, { useNewUrlParser: true });
app.use(express.static('pubic'));
app.use(bodyParser.urlencoded({extended : true}));
app.set("view engine","ejs");
app.use(expressSanitizer());
app.use(flash());

// PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "We are clinicapp devlopers",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use("user",new LocalStrategy(user.authenticate()));
passport.serializeUser(user.serializeUser());
passport.deserializeUser(user.deserializeUser());

//PASSPORT CONFIGURATION COMPLETE

//MULTER AND CLOUDINARY CONFIGURATION

var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: "dp71ux6po", 
  api_key: "933154881238682", 
  api_secret: "LDwYRt6xJlav0T4UI8-zJqYCaUk"
});

app.use(function(req, res, next){
res.locals.currentuser = req.user;
res.locals.error = req.flash("error");
res.locals.success = req.flash("success");
res.locals.warning = req.flash("warning");
res.locals.info = req.flash("success");
next();
});
//SETUP ENDS

//SOCKETS START
client.on('connection', function(socket){

    // Create function to send status
    sendStatus = function(name,s){
        client.to(people[name]).emit('status', s);
    }
    
    socket.on('loaddata', function(data){
        message.find({from :data.self._id, to :data.with._id},function(err, res1){
            if(err){
                console.log(err);
            }
            else{
                message.find({from :data.with._id, to :data.self._id},function(err, res2){
                    if(err){
                        console.log(err);
                    } else {
                        res = res1.concat(res2);
                        res.sort(function(a, b) {
                            var dateA = new Date(a.date), dateB = new Date(b.date);
                            return dateA - dateB;
                        });
                        client.to(socket.id).emit('output',res);
                    }
                });
            }
        });
    });

    socket.on('join', function (data) {
        console.log(data.self.username + " Connected")
        people[data.self.username] = socket.id     
    });
    
    //Client sending message
    socket.on('input', function(data){
        console.log(data);
        user.find({username:data.from},function(err,from){
            user.find({username:data.to},function(err,to){
                message.create({from:from[0]._id, text: data.message,to:to[0]._id}, function(err,newmsg){
                    if(err){
                        console.log(err);
                    } else {
                        newmsg.text = data.message;
                        newmsg.save();
                        console.log(newmsg);
                        client.to(people[data.from]).emit('output',[newmsg]);
                        client.to(people[data.to]).emit('output',[newmsg]);
                        // Send status object
                        sendStatus(data.from,{
                            message: 'Message sent',
                            clear: true
                        });
                    } 
                });
            });
        });
    });
    socket.on('disconnect', function() {
        console.log('Got disconnect!',people);
        arr = Object.entries(people);
        for(var i = 0; i < arr.length;i++){
            if(arr[i][1]==socket.id){
                user.find({username:arr[i][0]},function(err,usr){
                    if(err){
                        console.log(err);
                    } else {
                        usr[0].lastseen = Date.now();
                        usr[0].save();
                    }
                });
                delete people[arr[i][0]];
                break;
            }
        }
        console.log(people);
    }); 
});
//SOCKETS END

//HOME
app.get("/",function(req,res){
		res.render("homepage");
});

//ABOUT
app.get("/about", function(req, res) {
	res.render("about");
});

//FEEDBACK
app.get("/feedback", isLoggedIn, function(req, res) {
	res.render("feedback");
});

app.post("/feedback",isLoggedIn, function(req, res) {
	var fb=req.sanitize(req.body.feedback.feedback),
	un=req.sanitize(req.body.feedback.username);
	feedback.create({feedback:fb,username:un}, function(err, newfeedback) {
		if(err||!newfeedback) {
			req.flash("error","An error occured while submittng your feedback please try again later");
			res.redirect("back");
		}
		else {
			req.flash("success","Feedback submitted successfully ");
		}
	});
	res.redirect("/");
});

//AUTHENTICATION START
app.get("/signup",nouser,function(req,res){
		res.render("signup");
});

app.post("/signup",function(req,res){
	var suser = {
		username: req.sanitize(req.body.username),
		type: req.body.type,
		fname: req.sanitize(req.body.fname),
		lname: req.sanitize(req.body.lname),
		email: req.sanitize(req.body.email),
		contactnumber: req.sanitize(req.body.contactnumber)
	};
    user.register(suser, req.body.password ,function(err, newlyCreated){
        if(err||!newlyCreated){
			req.flash("error","A User With That Username Already Exists");
			return res.render("signup");
		}
		passport.authenticate("user")(req, res, function(){
			req.flash("success","Sign Up Successful");
			res.redirect("/");
		});
    });
});

app.get("/signin",nouser,function(req,res){
		res.render("signin");
});

app.post("/signin",nouser, passport.authenticate("user", 
 {
	 successRedirect: "/",
	 failureRedirect: "/signin"
 }), function(req, res){
});

app.get("/logout",isLoggedIn,function(req,res){
	req.logout();
	req.flash("success","Logged Out Successfully");
	res.redirect("/");
});
//AUTHENTICATION END

//CHAT START
app.get("/chat",isLoggedIn,function(req,res){
    var noMatch = false;
    if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        // Get all users from DB
        user.find({username: regex}, function(err, allusers){
            if(err){
                console.log(err);
            } else {
                if(allusers.length < 1) {
                    noMatch = true;
                }
                res.render("newchat",{allusers:allusers,noMatch:noMatch});
            }
        });
    } else {
        // Get all users from DB
        user.find({}, function(err, allusers){
            if(err){
                console.log(err);
            } else {
               res.render("newchat",{allusers:allusers,noMatch:noMatch});
            }
        });
    }
});
//CHAT END

//ALUMNI STARTS

//FILLING DETAILS
app.get("/fill_details_alumni/:id",isLoggedIn,isAlumni,noAlumInfo,function(req,res){
	var pm = { id : req.params.id };
	res.render("fill_details",{pm:pm});
});

app.post("/fill_details_alumni/:id",isLoggedIn,isAlumni,noAlumInfo, upload.single('image'), function(req, res) {
    cloudinary.uploader.upload(req.file.path, function(result) {
      user.findById(req.params.id, function(err, foundalumni){
        if(err){
            req.flash("error","An Error Occured!! Please Try Again Later");
			res.redirect("back");
        } else {
			if(result.secure_url)
			{		
				geocode(req.sanitize(req.body.address)).then((response) => {
						foundalumni.loc.x = response.candidates[0].location.x;
						foundalumni.loc.y = response.candidates[0].location.y;
						foundalumni.image = result.secure_url;
						foundalumni.image_id = result.public_id;
						foundalumni.description=req.sanitize(req.body.description);
						foundalumni.address = req.sanitize(req.body.address);	
						user.find({username:req.body.university},function(err,univ){
							if(err){
								console.log(err);
							} else {
								univ[0].recieved.push(foundalumni);
								foundalumni.sent.push(univ[0]);
								foundalumni.institute.push({graduation_date:req.body.year,id:univ[0].length?univ[0].id:null,name:req.body.university});;
								foundalumni.save();
								univ[0].save();
							}
						});
						req.flash("success","Details Added Successfully");
						res.redirect("/alumni/"+req.user._id);
				});
			}
			else{
				req.flash("error","An Error Occured!! Please Try Again Later");
				res.redirect("back");
			}
		}
	});
    });
});

//UPDATE DETAILS
app.get("/update_profile",isLoggedIn,isAlumni,function(req,res){
	res.render("update_profile");
});

app.post("/update_profile",isLoggedIn,isAlumni, upload.single('image'),function(req,res){
	user.findById(req.user._id, async function(err, alumni){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		} else {
			if (req.file) {
			  try {
				  await cloudinary.v2.uploader.destroy(alumni.image_id);
				  var result = await cloudinary.v2.uploader.upload(req.file.path);
				  alumni.image_id = result.public_id;
				  alumni.image = result.secure_url;
			  } catch(err) {
				  req.flash("error", err.message);
				  return res.redirect("back");
			  }
			}
			alumni.description = req.body.description;
			alumni.address=req.body.address;
			geocode(req.body.address).then((response) => {
				Object.assign(alumni, {
					loc: {
						x: response.candidates[0].location.x,
						y: response.candidates[0].location.y
					}
				})
				alumni.save();
				req.flash("success","Successfully Updated!");
				res.redirect("/alumni/" + alumni._id);
			});	
		}
	});
});

//ADD UNIVERSITY
app.post("/alumni/adduniversity",function(req,res){
	user.findById(req.user._id,function(err,alumni){
		if(err){
			console.log(err);
		} else {
			user.find({username:req.body.university},function(err,univ){
				if(err){
					console.log(err);
				} else {
					alumni.sent.push(univ[0]);
					univ[0].recieved.push(alumni._id);

					alumni.institute.push({branch:req.body.branch,graduation_date:req.body.year,id:univ.length?univ[0].id:null,name:req.body.university});
					alumni.save();
					univ[0].save();
				}
			});
			res.redirect("back");
		}
	});
});

//ADD SKILL
app.post("/alumni/addskill",function(req,res){
	user.findById(req.user._id,function(err,alumni){
		if(err){
			console.log(err);
		} else {
			alumni.skills.push(req.body.skill);
			alumni.save();
			res.redirect("back");
		}
	});
});

//VIEW ALUMNI
app.get("/alumni",function(req,res){
	var noMatch = null;
    if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        user.find({fname: regex}, function(err, allalumnis){
           if(err){
               console.log(err);
           } else {
              if(allalumnis.length < 1) {
                  noMatch = "NO MATCH FOUND :(";
              }
              res.render("alumni_list",{alumnis:allalumnis, noMatch: noMatch});
           }
        });
    } else {
        // Get all users from DB
        user.find({}, function(err, allalumnis){
           if(err){
               console.log(err);
           } else {
			if(allalumnis.length < 1) {
				noMatch = "NO MATCH FOUND :(";
			}
              res.render("alumni_list",{alumnis:allalumnis, noMatch: noMatch});
           }
        });
    }
});

app.get("/alumni/:id", function(req, res){
	user.findById(req.params.id).populate("appreciations").populate("appointments").exec(function(err, allalumnis){
        if(err||!allalumnis){
            console.log(err);
        } else {
			res.render("show",{alumni:allalumnis});
        }
    });
});

//ALUMNI FRIENDS
app.get("/friends",isLoggedIn,function(req,res){
	user.findById(req.user._id).populate("accepted").exec(function(err, foundalumni){
        if(err||!foundalumni){
            console.log(err);
        } else {
			noMatch = "No Friend Found";
			if(foundalumni.accepted.length>0)
				noMatch = null;
			res.render("alumni_list",{alumnis:foundalumni.accepted, noMatch: noMatch});
        }
    });
});

//SEND REQUEST
app.get("/send_request/:id",isLoggedIn,function(req,res){
	user.findById(req.user._id,function(err, from){
        if(err||!from){
            console.log(err);
        } else {
			user.findById(req.params.id,function(err,to){
				if(err||!to){
					console.log(err);
				} else {
					from.sent.push(to);
					to.recieved.push(from);
					from.save();
					to.save();
					res.redirect("back");
				}
			});
        }
    });
});

//ACCEPT REQUEST
app.get("/accept_request/:id",isLoggedIn,function(req,res){
	user.findById(req.user._id,function(err, from){
        if(err||!from){
            console.log(err);
        } else {
			user.findById(req.params.id,function(err,to){
				if(err||!to){
					console.log(err);
				} else {
					if(from.type=="university"){
						to.institute.forEach((curr)=>{
							if(curr.id==from._id){
								curr.verified = true;
							}
						});
					}
					from.accepted.push(to);
					to.accepted.push(from);
					var index = -1;
					to.sent.forEach((currentval,ind,arr)=>{
						if(currentval == from._id)
							index= ind;
					});
					to.sent.splice(index,1);
					index = -1;
					from.recieved.forEach((currentval,ind,arr)=>{
						if(currentval == to._id)
							index= ind;
					});
					from.recieved.splice(index,1);
					from.save();
					to.save();
					res.redirect("back");
				}
			});
        }
    });
});

//VIEW REQUEST
app.get("/recieved",isLoggedIn,function(req,res){
	user.findById(req.user._id).populate("recieved").exec(function(err, foundalumni){
        if(err||!foundalumni){
            console.log(err);
        } else {
			noMatch = "No Pending requests";
			if(foundalumni.recieved.length>0)
				noMatch = null;
			res.render("alumni_list",{alumnis:foundalumni.recieved, noMatch: noMatch});
        }
    });
});

//RECOMENDATION
// app.get("/alumni/:id/newrecommendation",isLoggedIn,function(req, res){
//     // find alumni by id
// 		user.findById(req.params.id, function(err, alumni){
//         if(err||!alumni){
//             console.log(err);
//         } else {
//              res.render("recommendation", {alumni: alumni});
//         }
//     })
// });

app.post("/alumni/:id/newrecommendation",isLoggedIn, function(req, res){
	user.findById(req.params.id, function(err, alumni){
		if(err||!alumni){
			req.flash("error","An Error Occured!! Please Try Again");
			res.redirect("back");
		} else {
		 appreciation.create(req.body.appreciation, function(err, appreciation){
			if(err||!appreciation){
				console.log(err);
			} else {
				appreciation.author.id = req.sanitize(req.user._id);
				appreciation.text=req.sanitize(req.body.text);
				appreciation.author.username = req.user.username;
               	appreciation.save();
				alumni.appreciations.push(appreciation);
				alumni.save();
				res.redirect("/alumni/" + req.params.id);
			}
		 });
		}
	});
 });

 app.post("/alumni/:id/deleterecommendation",isLoggedIn,isAlumni,function(req,res){
	appreciation.findByIdAndRemove(req.params.id,function(err){
		if(err){
			req.flash("error","Failed To Delete appreciation");
			res.redirect("back");
		}
		else{
			res.redirect("back");
		}
	})
});

//BLOG ROUTES
app.get("/myblogs",isLoggedIn,function(req,res){
	user.findById(req.user._id).populate("blogs").exec(function(err,founduser){
		if(err){
			console.log(err);
		} else {
			res.render("blogs",{blogs:founduser.blogs});
		}
	});
});

app.get("/network",isLoggedIn,function(req,res){
	user.findById(req.user._id).populate("accepted").populate("blogs").exec(function(err,founduser){
		if(err){
			console.log(err);
		} else {
			arr = []
			founduser.accepted.forEach((u)=>{
				arr =[...arr,...u.blogs];
			}); 
			console.log(arr);
			newarr = [];
			async function findi(u){
				await blog.findById(u,function(err,b){
				if(err){
					console.log(err);
				} else {
					newarr.push(b);
				}
				});
			}
			async function processArray(array) {
				// map array to promises
				const promises = array.map(findi);
				// wait until all promises are resolved
				await Promise.all(promises);
				newarr.sort(function(a, b){ 
					return new Date(b.date) - new Date(a.date); 
				});
				res.render("blogs",{blogs:newarr});
			}
			processArray(arr);
		}
	});
});

app.get("/viewblog/:id",function(req,res){
	user.findById(req.params.id).populate("blogs").exec(function(err,founduser){
		if(err){
			console.log(err);
		} else {
			res.render("blogs",{blogs:founduser.blogs});
		}
	});
});

app.post("/newblog",isLoggedIn,function(req,res){
	user.findById(req.user._id,function(err,alumni){
		if(err){
			console.log(err);
		} else {
			blog.create(req.body.blog, function(err, newblog){
				if(err){
					console.log(err);
				} else {
					newblog.author.id = req.sanitize(req.user._id);
					newblog.text=req.sanitize(req.body.text);
					newblog.url=req.sanitize(req.body.url);
					newblog.author.username = req.user.username;
					newblog.save();
					alumni.blogs.push(newblog);
					alumni.save();
					res.redirect("back");
				}
			 });
		}
	});
});

//SEARCH BY FILTER
app.get("/search_alumni_by_filter",function(req,res){
	res.render("search_alumni_by_filter");
});

app.post("/search_alumni_by_filter",function(req,res){
	var noMatch=null;
	var name = req.sanitize(req.body.name),
		univ = req.sanitize(req.body.university),
		branch = req.sanitize(req.body.branch),
		year = req.sanitize(req.body.year);
	const regex = new RegExp(escapeRegex(name), 'gi');
	user.find({fname: regex}, function(err, allalumnis){
		if(err){
			console.log(err);
		} else {
			filtered = allalumnis.filter((i)=>{
				for (x = 0; x < i.institute.length; i++) {
					if(i.institute[x].name == univ && i.institute[x].graduation_date == year && i.institute[x].branch == branch)
						return true;
				}
				return false;
			});
			if(filtered.length < 1) {
				noMatch = "NO MATCH FOUND :(";
			}
			res.render("alumni_list",{alumnis:filtered, noMatch: noMatch});
		}
	});
});

//ALUMNI ENDS 

//UNIVERSITY STARTS
app.get("/get_universities",function(req,res){
	user.find({type:"university"},function(err,universities){
		if(err){
			console.log(err);
		}
		else{
			res.json({universities:universities});
		}
	})
});

//FILLING DETAILS
app.get("/fill_details_institute/:id",isLoggedIn,isUniversity,function(req,res){
	var pm = { id : req.params.id };
	res.render("filldetails_univ",{pm:pm});
});

app.post("/fill_details_institute/:id",isLoggedIn,isUniversity, upload.single('image'), function(req, res) {
    cloudinary.uploader.upload(req.file.path, function(result) {
      user.findById(req.params.id, function(err, foundinstitute){
        if(err){
            req.flash("error","An Error Occured!! Please Try Again Later");
			res.redirect("back");
        } else {
			if(result.secure_url)
			{		
				geocode(req.sanitize(req.body.address)).then((response) => {
						foundinstitute.loc.x = response.candidates[0].location.x;
						foundinstitute.loc.y = response.candidates[0].location.y;
						foundinstitute.image = result.secure_url;
						foundinstitute.image_id = result.public_id;
						foundinstitute.description=req.sanitize(req.body.description);
						foundinstitute.address = req.sanitize(req.body.address);	
						foundinstitute.save();
						req.flash("success","Details Added Successfully");
						res.redirect("/alumni/"+req.user._id);
				});
			}
			else{
				req.flash("error","An Error Occured!! Please Try Again Later");
				res.redirect("back");
			}
		}
	});
    });
});

//VIEW INSTITUTE
app.get("/institute/:id", function(req, res){
	user.findById(req.params.id).populate("appreciations").populate("appointments").exec(function(err, allalumnis){
        if(err||!allalumnis){
            console.log(err);
        } else {
			res.render("institute_show",{institute:allalumnis});
        }
    });
});

//UNIVERSITY ENDS

//ADMIN ROUTES STARTS
app.get("/admin",isLoggedIn,isadmin,function(req,res){
	feedback.find({}, function(err, allfeedbacks){
		if(err||!allfeedbacks){
			req.flash("info","No feedback found");
			res.redirect("/");
		} else {
		   res.render("admin",{feedbacks:allfeedbacks});
		}
	 });
});
//ADMIN END

//PAGE NOT FOUND
app.get("/*", function(req, res){
	req.flash("error","Error 404! The page you are looking for is not found.");
	res.redirect("/");
});

//ASSISTING FUNCTIONS
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
	}
	req.flash("error","You Need To Login To Perform That");
    res.redirect("/signin");
}

function nouser(req, res, next){
    if(!req.user){
        return next();
	}
	req.flash("error","You Need To Log Out First");
    res.redirect("back");
}

function isAlumni(req, res, next){
		if(req.user.type=="alumni"){
        return next();
	}
	req.flash("info","Only alumnis Can Access That Page");
    res.redirect("back");
}

function noAlumInfo(req, res, next){
		if(req.user.type=="alumni"&&!req.user.description){
        return next();
	}
	req.flash("info","You Already Have Filled Description");
    res.redirect("back");
}

function isUniversity(req, res, next){
		if(req.user.type=="university"){
		return next();
	}
	req.flash("info","Only alumnis Can Access That Page");
    res.redirect("back");
}

function isadmin(req, res, next){
	if(req.user.type=="admin"){
	return next();
}
req.flash("info","Only Admins Can Access That Page");
res.redirect("back");
}

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

//STARTING THE SERVER ON PORT
app.listen(process.env.PORT||3000, function(){
	console.log("The Clinicapp Server Has Started!");
});