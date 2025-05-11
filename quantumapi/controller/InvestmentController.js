/**
 * @fileoverview Controller for handling investment operations
 * @date 2025-05-06
 */

const { Investment, INVESTMENT_STATUS } = require('../models/Investment');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

class InvestmentController {
    /**
     * Create a new investment
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async createInvestment(req, res) {
        try {
            const { planId, amount } = req.body;
            const userId = req.user.id;

            // Validate request data
            if (!planId || !amount) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Plan ID and amount are required' 
                });
            }

            // Get plan details to validate amount
            const plan = Investment.getInvestmentPlanById(planId);
            if (!plan) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid investment plan' 
                });
            }

            // Validate amount against plan limits
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum < plan.minDeposit || amountNum > plan.maxDeposit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Investment amount must be between ${plan.minDeposit} and ${plan.maxDeposit}` 
                });
            }

            // Check user's wallet balance
            const wallet = await Wallet.findByUserId(userId); // Corrected: Changed getByUserId to findByUserId
            if (!wallet || wallet.balance < amountNum) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Insufficient wallet balance' 
                });
            }

            // Deduct amount from wallet
            await Wallet.updateBalance(userId, wallet.balance - amountNum);

            // Create transaction record for the deduction
            await Transaction.create({
                userId,
                type: 'investment',
                amount: -amountNum,
                status: 'completed',
                description: `Investment in ${plan.name}`,
                createdAt: new Date()
            });

            // Create the investment
            const investment = await Investment.create({
                userId,
                planId,
                amount: amountNum,
                startDate: new Date()
            });

            return res.status(201).json({
                success: true,
                message: 'Investment created successfully',
                data: investment
            });
        } catch (error) {
            console.error('Error creating investment:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create investment',
                error: error.message
            });
        }
    }

    /**
     * Get user's active investments
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getActiveInvestments(req, res) {
        try {
            const userId = req.user.id;
            const investments = await Investment.getActiveByUserId(userId);

            // Add plan details to each investment
            const enhancedInvestments = investments.map(inv => {
                const plan = Investment.getInvestmentPlanById(inv.plan);
                return {
                    ...inv,
                    planDetails: plan
                };
            });

            return res.status(200).json({
                success: true,
                count: enhancedInvestments.length,
                data: enhancedInvestments
            });
        } catch (error) {
            console.error('Error fetching active investments:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch active investments',
                error: error.message
            });
        }
    }

    /**
     * Get user's investment history
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getInvestmentHistory(req, res) {
        try {
            const userId = req.user.id;
            const investments = await Investment.getHistoryByUserId(userId);

            // Add plan details to each investment
            const enhancedInvestments = investments.map(inv => {
                const plan = Investment.getInvestmentPlanById(inv.plan);
                return {
                    ...inv,
                    planDetails: plan
                };
            });

            return res.status(200).json({
                success: true,
                count: enhancedInvestments.length,
                data: enhancedInvestments
            });
        } catch (error) {
            console.error('Error fetching investment history:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch investment history',
                error: error.message
            });
        }
    }

    /**
     * Get all available investment plans
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getInvestmentPlans(req, res) {
        try {
            const plans = {
                starter: Investment.getInvestmentPlanById("starter"),
                premium: Investment.getInvestmentPlanById("premium"),
                vip: Investment.getInvestmentPlanById("vip")
            };

            return res.status(200).json({
                success: true,
                data: plans
            });
        } catch (error) {
            console.error('Error fetching investment plans:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch investment plans',
                error: error.message
            });
        }
    }

    /**
     * Get investment by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getInvestmentById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const investment = await Investment.getById(id);
            
            // Check if investment exists
            if (!investment) {
                return res.status(404).json({
                    success: false,
                    message: 'Investment not found'
                });
            }

            // Check if investment belongs to the requesting user
            if (investment.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to this investment'
                });
            }

            // Add plan details
            const plan = Investment.getInvestmentPlanById(investment.plan);
            const enhancedInvestment = {
                ...investment,
                planDetails: plan
            };

            return res.status(200).json({
                success: true,
                data: enhancedInvestment
            });
        } catch (error) {
            console.error('Error fetching investment:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch investment',
                error: error.message
            });
        }
    }

    /**
     * Cancel an active investment (admin or user)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async cancelInvestment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const isAdmin = req.user.isAdmin;

            // Get the investment
            const investment = await Investment.getById(id);
            
            // Check if investment exists
            if (!investment) {
                return res.status(404).json({
                    success: false,
                    message: 'Investment not found'
                });
            }

            // Check permissions (admin can cancel any, users can only cancel their own)
            if (!isAdmin && investment.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to cancel this investment'
                });
            }

            // Check if investment is active
            if (investment.status !== INVESTMENT_STATUS.ACTIVE) {
                return res.status(400).json({
                    success: false,
                    message: 'Only active investments can be cancelled'
                });
            }

            // Cancel the investment
            const cancelledInvestment = await Investment.cancel(id);

            // Return funds to user's wallet
            const wallet = await Wallet.findByUserId(investment.userId);
            await Wallet.updateBalance(investment.userId, wallet.balance + investment.amount);

            // Create transaction record for the refund
            await Transaction.create({
                userId: investment.userId,
                type: 'investment_refund',
                amount: investment.amount,
                status: 'completed',
                description: 'Refund from cancelled investment',
                createdAt: new Date()
            });

            return res.status(200).json({
                success: true,
                message: 'Investment cancelled successfully',
                data: cancelledInvestment
            });
        } catch (error) {
            console.error('Error cancelling investment:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel investment',
                error: error.message
            });
        }
    }
}

module.exports = InvestmentController;