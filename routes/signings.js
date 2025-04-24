const express = require('express');
const router = express.Router();
const uc = require('../controllers/signingsController');

router.get('/allsignings', uc.getAllSignings);

router.post('/', uc.postSigning); 
router.get('/', uc.getSignings);  
router.get('/:id/user', uc.getSigningsUser);
router.get('/:id', uc.getSigningbyId); 
router.put('/:id/update', uc.updateSigning);
router.delete('/:id/delete', uc.deleteSigning);

module.exports = router;