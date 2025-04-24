const express = require('express');
const router = express.Router();
const uc = require('../controllers/usersController');

router.post('/login', uc.login);
router.post('/decrypt', uc.decrypt);

router.post('/', uc.createUser);
router.get('/', uc.getAllUsers);
router.get('/:name', uc.getUserByName);
router.put('/:id', uc.updateUser);
router.put('/:id/state', uc.updateUserState);
router.put('/:id/log', uc.updateUserLog);

module.exports = router;
