const User = require('../models/user.model');
const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const user = await authService.updateMe(req.user.id, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error('Fichier manquant');
      error.status = 400;
      return next(error);
    }

    const mimeType = req.file.mimetype;
    const base64 = req.file.buffer.toString('base64');
    const logoData = `data:${mimeType};base64,${base64}`;

    const user = await User.findByPk(req.user.id);
    await user.update({ logo_data: logoData });

    res.json({ logo_data: logoData });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getMe, updateMe, uploadLogo };
