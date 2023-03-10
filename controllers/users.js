require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const UserModel = require("../models/users");
const { body, validationResult } = require('express-validator');
const escape = require('escape-html');

const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }
  const existingUser = await UserModel.find({ email: req.body.email });
  if (existingUser.length !== 0) {
    return res.status(203).json({ error: "The user already exist" });
  }
  bcrypt
    .hash(req.body.password, 10)
    .then((hash) => {
      const user = new UserModel({
        email: escape(req.body.email),
        password: hash,
        username: escape(req.body.username),
        phone: escape(req.body.phone),
      });
      user
        .save()
        .then(() => res.status(201).json({ message: "User created" }))
        .catch((e) => res.status(203).json({ error: "error hash" }));
    })
    .catch(() => res.status(203).json({ error: "Problem with password" }));
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  UserModel.findOne({ email: req.body.email })
    .then((user) => {
      if (!user) {
        return res.status(203).json({ error: "User not found" });
      }
      bcrypt
        .compare(req.body.password, user.password)
        .then((valid) => {
          if (!valid) {
            return res.status(203).json({ error: "Password incorrect" });
          }
          req.session.user = user;
          return getToken(user, res, req);
        })
        .catch((error) => res.status(500).json({ error }));
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
};

const getToken = async (user, res, req) => {
  const token = jwt.sign(
    {
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  req.session.token = token;
  res.json({
    message: "Auth successful",
    user,
    token: token,
  });
};

const getUserById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const user = await UserModel.find({ _id: req.params.user_id });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

const update = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    let data = {
      ...req.body,
      updatedAt: Date.now(),
      lastModified: Date.now(),
    };
    delete data.password;
    await UserModel.updateOne(
      { _id: req.params.user_id },
      { $set: data }
    ).exec();
    const user = await UserModel.find({ _id: req.params.user_id });
    req.session.user = user[0];
    res.status(200).json(user[0]);
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

const autoLogin = async (req, res) => {
  const token = req.session.token;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    if (!token) {
      return res.status(200).send({ message: "No token provided !" });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        req.session.destroy();
        return res.status(200).send({ message: "No token provided !" });
      }
      req.userData = decoded;
      return res
        .status(200)
        .json({ message: "Auto Login success", user: req.session.user });
    });
  } catch (error) {
    return res.status(500).send({ error: error });
  }
};

const logout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  req.session.destroy();
  res
    .clearCookie("token", { httpOnly: true })
    .status(200)
    .json({ message: "Disconnect success" });
};

module.exports = {
  createUser,
  getUserById,
  login,
  update,
  autoLogin,
  logout,
};
