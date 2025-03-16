const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const authMiddleware = require('../middleware/authMiddleware');

// Property CRUD operations
router.post('/',propertyController.createProperty);
router.get('/', propertyController.getAllProperties);
router.get('/my-properties',propertyController.getMyProperties);
router.get('/:id', propertyController.getPropertyById);
router.put('/:id',propertyController.updateProperty);
router.delete('/:id',propertyController.deleteProperty);

// Property search and filters
router.get('/search', propertyController.searchProperties);
router.get('/filter', propertyController.filterProperties);

// Property statistics
router.get('/:id/views',propertyController.getPropertyViews);
router.post('/:id/view', propertyController.incrementPropertyView);

// Add this new route before the module.exports
router.post('/create-fake', propertyController.createFakeProperty);

// Add this new route
router.get('/user/:userId', propertyController.getUserProperties);

module.exports = router; 