const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// Controller for admin to get all users
exports.listUsers = async (req, res) => {
    try {
        // Implement logic to fetch all users, potentially with pagination
        // For now, let's assume User.findAll() exists or we create it
        const users = await User.findAll(); // You might need to implement User.findAll()
        if (!users) {
            return res.status(404).json({ success: false, message: 'No users found' });
        }
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ success: false, message: 'Failed to list users', error: error.message });
    }
};

// Controller for admin to get a specific user's details
exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Optionally, fetch wallet and transaction details here
        const wallet = await Wallet.findByUserId(userId);
        // const transactions = await Transaction.findByUserId(userId); // Assuming this method exists

        res.status(200).json({ 
            success: true, 
            data: { 
                user, 
                wallet, 
                // transactions 
            } 
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user details', error: error.message });
    }
};

// Controller for admin to update user details
exports.updateUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body; // e.g., { firstName, lastName, email, isActive, etc. }
        
        // Ensure critical fields like password or role are handled carefully or separately
        // For now, a generic update, but you'll want to be specific about what can be updated
        const updatedUser = await User.updateProfile(userId, updates); // User.updateProfile might need adjustment

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found or update failed' });
        }
        res.status(200).json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).json({ success: false, message: 'Failed to update user details', error: error.message });
    }
};

// Controller for admin to lock a user account
exports.lockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        // You'll need a method in User model, e.g., User.setIsActive(userId, false) or User.lock(userId)
        const user = await User.deactivate(userId); // Assuming User.deactivate sets a flag
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found or already inactive' });
        }
        res.status(200).json({ success: true, message: 'User locked successfully' });
    } catch (error) {
        console.error('Error locking user:', error);
        res.status(500).json({ success: false, message: 'Failed to lock user', error: error.message });
    }
};

// Controller for admin to unlock a user account
exports.unlockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        // You'll need a method in User model, e.g., User.setIsActive(userId, true) or User.unlock(userId)
        // For now, let's assume there's a User.activate(userId) or similar
        // This might involve setting an 'isActive' flag to true
        const user = await User.activate(userId); // Placeholder: User.activate needs to be implemented
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found or could not be activated' });
        }
        res.status(200).json({ success: true, message: 'User unlocked successfully' });
    } catch (error) {
        console.error('Error unlocking user:', error);
        res.status(500).json({ success: false, message: 'Failed to unlock user', error: error.message });
    }
};

// Controller for admin to update a user's balance
exports.updateUserBalance = async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Validate userId - ISSUE: This check is causing problems
        // since req.params.id is a string, not undefined
        if (userId === undefined || userId === null) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID: Missing ID parameter' 
            });
        }
        
        const parsedUserId = parseInt(userId, 10);
        
        // Check if the parsed ID is valid
        if (isNaN(parsedUserId) || parsedUserId <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID: Not a positive number' 
            });
        }
        
        const { adjustment, reason } = req.body;
        
        // Verify user exists before proceeding
        const user = await User.findById(parsedUserId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Convert adjustment to a number and validate
        const adjustmentAmount = parseFloat(adjustment);
        if (isNaN(adjustmentAmount)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid adjustment amount' 
            });
        }
        
        // Find the user's wallet - using your implementation's method
        let wallet = await Wallet.findByUserId(parsedUserId); 
        
        if (!wallet) {
            // If wallet doesn't exist, create one with the adjustment amount as balance
            wallet = await Wallet.createForUser(parsedUserId);
            
            // After creating the wallet, update its balance
            if (wallet && adjustmentAmount >= 0) {
                await Wallet.updateBalance(parsedUserId, adjustmentAmount, 0);
                // Refresh wallet data
                wallet = await Wallet.findByUserId(parsedUserId);
            }
        } else {
            // Update the existing wallet balance
            let currentBalance = parseFloat(wallet.balance);
            currentBalance += adjustmentAmount;
            
            if (currentBalance < 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Insufficient balance for this reduction' 
                });
            }
            
            // Use your implementation's update method
            await Wallet.updateBalance(parsedUserId, currentBalance, wallet.pendingBalance || 0);
            // Refresh wallet data after update
            wallet = await Wallet.findByUserId(parsedUserId);
        }
        
        // Log the transaction
        await Transaction.create({
            userId: parsedUserId,
            amount: Math.abs(adjustmentAmount),
            type: 'Admin Adjustment', // Changed from 'deposit'/'withdrawal'
            status: 'completed',
            details: reason || (adjustmentAmount >= 0 ? 'Admin balance increase' : 'Admin balance reduction'), // Changed from description to details
            isAdminAction: true // This property is not in the Transaction model, consider adding it or removing this line
        });
        
        return res.json({ 
            success: true, 
            message: 'User balance updated successfully', 
            newBalance: wallet.balance 
        });
    } catch (error) {
        console.error('Error updating user balance:', error);
        return res.status(500).json({ success: false, message: 'Failed to update user balance', details: error.message });
    }
};


// Controller for admin to get details of a specific withdrawal
// ...existing code...
exports.getWithdrawalDetails = async (req, res) => {
    console.log(`[getWithdrawalDetails] Attempting to fetch withdrawal with ID from params: ${req.params.id}`);
    try {
        const transactionIdParam = req.params.id;
        const transactionId = parseInt(transactionIdParam, 10); // Parse the ID to an integer

        if (isNaN(transactionId)) {
            console.log(`[getWithdrawalDetails] Invalid transaction ID format: ${transactionIdParam}`);
            return res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
        }
        
        // Use the parsed transactionId
        const withdrawal = Transaction.getById(transactionId); 
        
        if (!withdrawal) {
            console.log(`[getWithdrawalDetails] Withdrawal transaction with ID ${transactionId} not found in database.`);
            return res.status(404).json({ 
                success: false, 
                message: 'Withdrawal transaction not found' 
            });
        }

        // CORRECTED TYPE CHECK: Make it case-insensitive and check if withdrawal.type exists
        if (!withdrawal.type || withdrawal.type.toLowerCase() !== 'withdrawal') {
            console.log(`[getWithdrawalDetails] Transaction ID ${transactionId} found, but it's not a withdrawal. Type: ${withdrawal.type}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Transaction found, but it is not a withdrawal type.' 
            });
        }
        
        console.log(`[getWithdrawalDetails] Withdrawal ID ${transactionId} found. Fetching user ID: ${withdrawal.userId}`);
        const user = User.findById(withdrawal.userId); // Assuming synchronous
        
        let parsedDetails = {};
        if (withdrawal.details) {
            try {
                parsedDetails = JSON.parse(withdrawal.details);
            } catch (parseError) {
                console.error(`[getWithdrawalDetails] Error parsing details for withdrawal ID ${transactionId}:`, parseError);
            }
        }

        const enhancedWithdrawal = {
            ...withdrawal,
            user: user ? {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
            } : { 
                id: withdrawal.userId, 
                username: 'N/A', 
                email: 'N/A', 
                fullName: 'Unknown User' 
            },
            details: parsedDetails
        };
        
        console.log(`[getWithdrawalDetails] Successfully processed withdrawal ID ${transactionId}.`);
        res.status(200).json({ 
            success: true, 
            withdrawal: enhancedWithdrawal
        });
    } catch (error) {
        console.error(`[getWithdrawalDetails] Error fetching withdrawal details for ID ${req.params.id}:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch withdrawal details', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
};

// Controller for admin to list all transactions (Deposits or Withdrawals) with search
exports.listAllTransactions = async (req, res) => {
    try {
        const { type, search, limit = 50, offset = 0 } = req.query;
        
        // Make type check case-insensitive
        const typeLower = type ? type.toLowerCase() : '';
        
        if (!type || (typeLower !== 'deposit' && typeLower !== 'withdrawal')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction type specified. Must be \'Deposit\' or \'Withdrawal\'.'
            });
        }

        // Pass the lowercase version to your model
        const result = await Transaction.getAllByTypeAndSearch(
            typeLower, // Use lowercase version
            search,
            parseInt(limit),
            parseInt(offset)
        );

        res.status(200).json({
            success: true,
            transactions: result.transactions,
            totalCount: result.totalCount
        });

    } catch (error) {
        console.error(`Error listing all ${type} transactions for admin:`, error);
        res.status(500).json({
            success: false,
            message: `Failed to list ${type} transactions.`,
            error: error.message
        });
    }
};
// You might need to add User.findAll() to your User model:
// static findAll() {
//   return db.prepare('SELECT id, username, email, firstName, lastName, role, isActive, createdAt FROM users').all();
// }

// You might need to add User.activate() to your User model:
// static activate(userId) {
//   // This depends on how you manage user status (e.g., an 'isActive' column)
//   // Example: db.prepare('UPDATE users SET isActive = 1 WHERE id = ?').run(userId);
//   // return this.findById(userId);
//   console.warn("User.activate() needs to be implemented based on your User schema.");
//   return null; 
// }

// Ensure Wallet.updateBalance can handle direct setting of balance
// static updateBalance(userId, balance, pendingBalance) {
//   db.prepare('UPDATE wallets SET balance = ?, pendingBalance = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?')
//     .run(balance, pendingBalance, userId);
//   return this.findByUserId(userId);
// }
