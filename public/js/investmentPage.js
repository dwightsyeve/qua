/**
 * Investment Page Generator
 * Creates a full page investment form based on the selected plan
 */

// Function to create the investment page HTML
function generateInvestmentPageHTML(planId) {
  // Get the plan data
  const plan = window.investmentPlans?.[planId];
  
  if (!plan) {
    alert('Investment plan not found. Please try again.');
    window.location.href = 'investment.html';
    return;
  }
  
  // Create a safe plan object with defaults for any missing properties
  const safePlan = {
    name: plan.name || `Unknown Plan`,
    dailyRoi: plan.dailyRoi || 0.01,
    totalReturn: plan.totalReturn || 1.5,
    duration: plan.duration || 30,
    minDeposit: plan.minDeposit || 50,
    maxDeposit: plan.maxDeposit || Infinity,
    color: plan.color || '#6366f1'
  };

  // Get the plan color for styling
  const planColor = safePlan.color;
  const planColorClass = planId === 'starter' ? 'indigo' : 
                        planId === 'premium' ? 'green' : 
                        planId === 'vip' ? 'indigo' : 'indigo';

  // Generate full HTML document
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invest in ${safePlan.name} | QuantumFX</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
      <link rel="stylesheet" href="css/styles.css">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --primary-color: ${planColor};
          --secondary-color: ${planId === 'premium' ? '#059669' : '#4f46e5'};
        }
        
        body {
          background-color: #f8fafc;
          font-family: 'Poppins', sans-serif;
          color: #1f2937;
        }
        
        .header-banner {
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          color: white;
          padding: 2rem 0;
        }
        
        .form-container {
          max-width: 800px;
          margin: -50px auto 3rem;
          background: white;
          border-radius: 1rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          padding: 2rem;
        }
        
        .plan-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background-color: ${planId === 'starter' ? '#dbeafe' : 
                            planId === 'premium' ? '#d1fae5' : 
                            '#e0e7ff'};
          color: ${planId === 'starter' ? '#1e40af' : 
                planId === 'premium' ? '#065f46' : 
                '#3730a3'};
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .calculation-preview {
          background-color: ${planId === 'starter' ? '#eef2ff' : 
                            planId === 'premium' ? '#ecfdf5' : 
                            '#eef2ff'};
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .btn-primary {
          background-color: var(--primary-color);
          border: none;
        }
        
        .btn-primary:hover {
          background-color: var(--secondary-color);
        }
      </style>
  </head>
  <body>
    <div class="header-banner">
      <div class="container">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold">Invest in ${safePlan.name}</h1>
            <p class="opacity-80">Complete your investment details below</p>
          </div>
          <a href="investment.html" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition flex items-center">
            <i class="fas fa-arrow-left mr-2"></i> Back to Plans
          </a>
        </div>
      </div>
    </div>
    
    <div class="container">
      <div class="form-container">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- Investment Details -->
          <div class="w-full md:w-2/3">
            <h2 class="text-xl font-semibold mb-4">Investment Details</h2>
            
            <form id="investmentForm">
              <div class="mb-4">
                <div class="flex justify-between mb-2">
                  <span class="plan-badge">${planId.charAt(0).toUpperCase() + planId.slice(1)}</span>
                  <span class="text-sm text-gray-500">Plan ID: ${planId}</span>
                </div>
                <div class="mb-2">
                  <h3 class="font-medium text-lg">${safePlan.name}</h3>
                  <p class="text-gray-500 text-sm">
                    ${safePlan.dailyRoi * 100}% daily return · ${safePlan.duration} days · ${safePlan.totalReturn * 100}% total return
                  </p>
                </div>
              </div>
              
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1" for="investmentAmount">Investment Amount (USDT)</label>
                <input 
                  type="number" 
                  id="investmentAmount" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                  placeholder="Enter amount" 
                  required 
                  min="${safePlan.minDeposit}" 
                  ${safePlan.maxDeposit !== Infinity ? `max="${safePlan.maxDeposit}"` : ''}
                  oninput="calculateInvestmentPreview()"
                >
                <p class="text-xs text-gray-500 mt-1">
                  Min: ${safePlan.minDeposit.toLocaleString()} USDT
                  ${safePlan.maxDeposit !== Infinity ? `, Max: ${safePlan.maxDeposit.toLocaleString()} USDT` : ''}
                </p>
              </div>
              
              <div id="calculationResult" class="calculation-preview hidden">
                <h4 class="font-medium text-${planColorClass}-700 mb-2">Investment Preview</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>Daily Return:</div>
                  <div id="dailyReturn" class="font-medium text-right">0 USDT</div>
                  
                  <div>Contract Duration:</div>
                  <div id="duration" class="font-medium text-right">${safePlan.duration} days</div>
                  
                  <div>Total Profit:</div>
                  <div id="totalProfit" class="font-medium text-right">0 USDT</div>
                  
                  <div>Final Return:</div>
                  <div id="finalReturn" class="font-medium text-right text-green-600">0 USDT</div>
                </div>
              </div>
              
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentMethod">Payment Method</label>
                <select id="paymentMethod" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                  <option value="wallet_balance" selected>Wallet Balance</option>
                </select>
                
                <div id="walletBalanceInfo" class="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-700">Available Balance:</span>
                    <span id="availableBalance" class="font-bold">Loading...</span>
                  </div>
                </div>
              </div>
              
              <div class="mb-6">
                <div class="flex items-start">
                  <input type="checkbox" id="termsAgreement" class="mt-1 mr-2" required>
                  <label for="termsAgreement" class="text-sm text-gray-700">
                    I agree to the <a href="#" class="text-${planColorClass}-600 hover:underline">terms and conditions</a> 
                    and understand that investments carry risk. I am investing funds that I can 
                    afford to commit for the full duration of the investment.
                  </label>
                </div>
              </div>
              
              <div class="flex flex-col md:flex-row gap-3">
                <a href="investment.html" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-center">
                  Cancel
                </a>
                <button 
                  type="button" 
                  id="submitButton"
                  onclick="submitInvestment('${planId}')"
                  class="flex-grow px-4 py-2 bg-${planColorClass}-600 text-white rounded-md hover:bg-${planColorClass}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  disabled
                >
                  <i class="fas fa-check-circle mr-2"></i> Confirm Investment
                </button>
              </div>
            </form>
          </div>
          
          <!-- Plan Summary -->
          <div class="w-full md:w-1/3">
            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="text-lg font-medium mb-3">Plan Summary</h3>
              <ul class="space-y-2">
                <li class="flex justify-between">
                  <span class="text-gray-600">Plan:</span>
                  <span class="font-medium">${safePlan.name}</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600">Daily ROI:</span>
                  <span class="font-medium">${safePlan.dailyRoi * 100}%</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600">Duration:</span>
                  <span class="font-medium">${safePlan.duration} days</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600">Total Return:</span>
                  <span class="font-medium">${safePlan.totalReturn * 100}%</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-gray-600">Min. Deposit:</span>
                  <span class="font-medium">${safePlan.minDeposit} USDT</span>
                </li>
                ${safePlan.maxDeposit !== Infinity ? `
                <li class="flex justify-between">
                  <span class="text-gray-600">Max. Deposit:</span>
                  <span class="font-medium">${safePlan.maxDeposit} USDT</span>
                </li>` : ''}
              </ul>
              
              <hr class="my-4">
              
              <div class="bg-blue-50 p-3 rounded-lg">
                <h4 class="font-medium text-blue-700 flex items-center gap-2 mb-2">
                  <i class="fas fa-info-circle"></i> Important Info
                </h4>
                <ul class="text-sm text-blue-800 space-y-2">
                  <li>• Capital is returned at the end of the investment period</li>
                  <li>• Daily profits are calculated from deposit confirmation</li>
                  <li>• Early cancellation may incur fees</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <footer class="text-center text-gray-500 text-sm pb-6">
      <p>&copy; 2025 QuantumFX Pro. All rights reserved.</p>
      <p class="mt-1">Secure Investment Platform</p>
    </footer>

    <script>
      // Store the plan details for calculations
      const currentPlan = {
        id: '${planId}',
        name: '${safePlan.name}',
        dailyRoi: ${safePlan.dailyRoi},
        totalReturn: ${safePlan.totalReturn},
        duration: ${safePlan.duration},
        minDeposit: ${safePlan.minDeposit},
        maxDeposit: ${safePlan.maxDeposit !== Infinity ? safePlan.maxDeposit : 'Infinity'}
      };
      
      // Calculate and update the investment preview
      function calculateInvestmentPreview() {
        const investmentAmountInput = document.getElementById('investmentAmount');
        const calculationResult = document.getElementById('calculationResult');
        const dailyReturnElement = document.getElementById('dailyReturn');
        const totalProfitElement = document.getElementById('totalProfit');
        const finalReturnElement = document.getElementById('finalReturn');
        
        if (!investmentAmountInput || !calculationResult || !dailyReturnElement || 
            !totalProfitElement || !finalReturnElement) {
          return;
        }
        
        const amount = parseFloat(investmentAmountInput.value);
        
        // Validate the amount
        if (isNaN(amount) || amount <= 0 || 
            amount < currentPlan.minDeposit || 
            (currentPlan.maxDeposit !== Infinity && amount > currentPlan.maxDeposit)) {
          calculationResult.classList.add('hidden');
          return;
        }
        
        // Calculate values
        const dailyReturn = amount * currentPlan.dailyRoi;
        const totalProfit = amount * (currentPlan.totalReturn - 1);
        const finalReturn = amount * currentPlan.totalReturn;
        
        // Update DOM elements
        dailyReturnElement.textContent = \`\${dailyReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT\`;
        totalProfitElement.textContent = \`\${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT\`;
        finalReturnElement.textContent = \`\${finalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT\`;
        
        calculationResult.classList.remove('hidden');
      }
      
      // Handle checkbox state to enable/disable submit button
      document.addEventListener('DOMContentLoaded', function() {
        const termsCheckbox = document.getElementById('termsAgreement');
        const submitButton = document.getElementById('submitButton');
        
        if (termsCheckbox && submitButton) {
          termsCheckbox.addEventListener('change', function() {
            submitButton.disabled = !this.checked;
          });
        }
        
        // Fetch wallet balance
        fetchWalletBalance();
      });
      
      // Fetch wallet balance
      async function fetchWalletBalance() {
        const availableBalanceElement = document.getElementById('availableBalance');
        if (!availableBalanceElement) return;
        
        try {
          // Get token from storage
          let token = sessionStorage.getItem('authToken') || localStorage.getItem('token');
          
          if (!token) {
            throw new Error('Authentication token not found.');
          }
          
          const response = await fetch('/api/wallet/balance', {
            headers: {
              'Authorization': \`Bearer \${token}\`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(\`Failed to fetch balance: \${errorData.message || response.statusText}\`);
          }
          
          const data = await response.json();
          if (data.balance !== undefined) {
            availableBalanceElement.textContent = \`\${parseFloat(data.balance).toFixed(2)} USDT\`;
          } else {
            availableBalanceElement.textContent = 'N/A';
          }
        } catch (error) {
          console.error('Error fetching wallet balance:', error);
          availableBalanceElement.textContent = 'Error';
        }
      }
      
      // Submit investment
      async function submitInvestment(planId) {
        const investmentAmountInput = document.getElementById('investmentAmount');
        const termsAgreementCheckbox = document.getElementById('termsAgreement');
        const paymentMethodSelect = document.getElementById('paymentMethod');
        const submitButton = document.getElementById('submitButton');
        
        if (!investmentAmountInput || !termsAgreementCheckbox || !paymentMethodSelect || !submitButton) {
          alert('Form elements not found. Please refresh the page and try again.');
          return;
        }
        
        // Validate form
        if (!planId) {
          alert('Investment plan not selected. Please try again.');
          return;
        }
        
        const amount = parseFloat(investmentAmountInput.value);
        if (isNaN(amount) || amount < currentPlan.minDeposit || 
            (currentPlan.maxDeposit !== Infinity && amount > currentPlan.maxDeposit)) {
          alert(\`Please enter a valid amount between \${currentPlan.minDeposit.toLocaleString()} and \${currentPlan.maxDeposit !== Infinity ? currentPlan.maxDeposit.toLocaleString() : 'unlimited'} USDT.\`);
          return;
        }
        
        if (!paymentMethodSelect.value) {
          alert('Please select a payment method.');
          return;
        }
        
        if (!termsAgreementCheckbox.checked) {
          alert('Please agree to the terms and conditions.');
          return;
        }
        
        try {
          // Disable submit button and show loading state
          submitButton.disabled = true;
          submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
          
          // Get authentication token
          const token = sessionStorage.getItem('authToken') || localStorage.getItem('token');
          if (!token) {
            alert('Authentication required. Please login again.');
            window.location.href = '/auth.html?redirect=investment.html';
            return;
          }
          
          // Send investment data to server
          const response = await fetch('/api/investment/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${token}\`
            },
            body: JSON.stringify({
              planId,
              amount,
              paymentMethod: paymentMethodSelect.value
            })
          });
          
          // Handle unauthorized response
          if (response.status === 401) {
            alert('Your session has expired. Please log in again.');
            window.location.href = '/auth.html?redirect=investment.html';
            return;
          }
          
          // Handle insufficient balance
          if (response.status === 400) {
            const errorData = await response.json();
            if (errorData.message && errorData.message.includes('Insufficient')) {
              alert('Insufficient wallet balance. Please deposit funds first.');
              return;
            }
          }
          
          // Handle other non-successful responses
          if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to create investment');
            } else {
              throw new Error(\`Server error (\${response.status}): Please try again later\`);
            }
          }
          
          const data = await response.json();
          
          // Show success message and redirect
          alert('Investment created successfully! Your investment is now active.');
          window.location.href = 'investment.html#active-investments';
        } catch (error) {
          console.error('Error creating investment:', error);
          alert(\`Error: \${error.message || 'Failed to create investment. Please try again.'}\`);
        } finally {
          // Reset button state
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Confirm Investment';
        }
      }
    </script>
  </body>
  </html>
  `;

  // Replace the current document with the new HTML
  document.open();
  document.write(html);
  document.close();
}

// Function to navigate to a specific plan investment page
function showInvestmentPage(planId) {
  // Ensure we have plan data available
  if (!window.investmentPlans || !window.investmentPlans[planId]) {
    console.error(`Plan with ID ${planId} not found.`);
    alert('Investment plan not found. Please try again.');
    return;
  }
  
  // Generate and display the investment page
  generateInvestmentPageHTML(planId);
}
