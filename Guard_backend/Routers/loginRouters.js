
const {loginUser} = require("../Controllers/loginController");
// const { addLeave } = require("../Controllers/leaveController");
const express = require("express");
const router = express.Router();

router.post("/login", loginUser);

module.exports = router
