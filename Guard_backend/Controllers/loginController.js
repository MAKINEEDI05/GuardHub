

const login = require("../models/logins");

const loginUser = async(req, res) => {
    const userName = req.body.email || req.body.userName;
    const userPassword = req.body.password;
    // console.log("wertyui")
    console.log(userName, userPassword);
    const user = await login.findOne({userName, userPassword});
    console.log(user);
    if(user) {
        res.status(200).json({message: "Login successful", user});
    } else {
        res.status(401).json({message: "Invalid credentials"});
    }
};

module.exports = {loginUser};
