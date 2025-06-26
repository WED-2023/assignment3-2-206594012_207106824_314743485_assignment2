var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");

router.post("/Register", async (req, res, next) => {
  try {
    // parameters exists
    // valid parameters
    // username exists
    let user_details = {
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      country: req.body.country,
      password: req.body.password,
      email: req.body.email,
      profilePic: req.body.profilePic
    }
    let users = [];
    users = await DButils.execQuery("SELECT username from users", []);

    if (users.find((x) => x.username === user_details.username))
      throw { status: 409, message: "Username taken" };

    // add the new username /// bcrypt כדי לאבטח את הסיסמה ולעשות עליה hasing
    let hash_password = bcrypt.hashSync(
      user_details.password,
      parseInt(process.env.bcrypt_saltRounds)
    );

    const query = `
      INSERT INTO users (username, firstname, lastname, country, password, email, profilePic) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      user_details.username,
      user_details.firstname,
      user_details.lastname,
      user_details.country,
      hash_password,
      user_details.email,
      user_details.profilePic
    ];

    await DButils.execQuery(query, params);
    
    res.status(201).send({ message: "user created", success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/Login", async (req, res, next) => {
  try {
    console.log("Login route called. Body:", req.body);  

    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users", []);
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Username or Password incorrect" };

    // check that the password is correct
    const user = (
      await DButils.execQuery(
        "SELECT * FROM users WHERE username = ?",
        [req.body.username]
      )
    )[0];

    if (!bcrypt.compareSync(req.body.password, user.password)) {
      throw { status: 401, message: "Username or Password incorrect" };
    }

    // Set cookie
    req.session.username = user.username;
    console.log("session user_id login: " + req.session.username);


    // return cookie
    res.status(200).send({ message: "login succeeded " , success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/session', (req, res) => {
  if (req.session && req.session.username) {
    res.send({ username: req.session.username });
  } else {
    res.status(401).send({ message: "No active session" });
  }
});


router.post("/Logout", function (req, res) {
  console.log("session username Logout: " + req.session.username);
  req.session.destroy(err => {
    if (err) {
      console.error("Failed to destroy session:", err);
      return res.status(500).send({ success: false, message: "Logout failed" });
    }
    res.clearCookie("connect.sid"); 
    res.send({ success: true, message: "logout succeeded" });
  });
});


module.exports = router;


console.log("auth.js loaded");
