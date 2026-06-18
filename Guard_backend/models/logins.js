
// import mongoose from "mongoose";
const mongoose = require("mongoose");


const login = mongoose.Schema({

    userName:{
        type: String,
        required: true,
    },
    userPassword:{
        type: String,
        required: true
    }
})


module.exports = mongoose.model('login',login);


