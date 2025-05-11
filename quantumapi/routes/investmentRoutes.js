/**
 * @fileoverview Investment routes for handling all investment-related API endpoints
 * @version 1.0.0
 * @date 2025-05-06
 */

const express = require('express');
const router = express.Router();
const InvestmentController = require('../controller/InvestmentController');
const { authenticateToken } = require('../middleware/authmiddleware');

// Apply authentication middleware to all investment routes
router.use(authenticateToken);

// Get investment plans
router.get('/plans', InvestmentController.getInvestmentPlans);

// Get active investments for the current user
router.get('/active', InvestmentController.getActiveInvestments);

// Get investment history for the current user
router.get('/history', InvestmentController.getInvestmentHistory);

// Create a new investment
router.post('/create', InvestmentController.createInvestment);

// Cancel an investment
router.post('/cancel/:id', InvestmentController.cancelInvestment);

module.exports = router;