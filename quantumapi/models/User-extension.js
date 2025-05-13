/**
 * Find users who were referred by a specific user
 * @param {number} referrerId - The ID of the referring user
 * @returns {Array} Array of user objects who were referred by this user
 */
static findByReferredBy(referrerId) {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE referredBy = ? ORDER BY createdAt DESC');
    return stmt.all(referrerId);
  } catch (error) {
    console.error(`Error finding users referred by ${referrerId}:`, error);
    return [];
  }
}
