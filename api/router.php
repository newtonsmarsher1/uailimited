<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the API path
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$api_path = str_replace('/api', '', $path);

// Route the API request
switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':
        handlePostRequest($api_path);
        break;
    case 'GET':
        handleGetRequest($api_path);
        break;
    case 'PUT':
        handlePutRequest($api_path);
        break;
    case 'DELETE':
        handleDeleteRequest($api_path);
        break;
    default:
        errorResponse('Method not allowed', 405);
}

function handlePostRequest($path) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($path) {
        case '/auth/login':
            handleLogin($input);
            break;
        case '/auth/register':
            handleRegister($input);
            break;
        case '/tasks/complete':
            handleCompleteTask($input);
            break;
        case '/investments/create':
            handleCreateInvestment($input);
            break;
        case '/withdrawals/request':
            handleWithdrawalRequest($input);
            break;
        case '/recharge/mpesa':
            handleMpesaRecharge($input);
            break;
        default:
            errorResponse('Endpoint not found', 404);
    }
}

function handleGetRequest($path) {
    switch ($path) {
        case '/user/profile':
            handleGetProfile();
            break;
        case '/user/stats':
            handleGetUserStats();
            break;
        case '/tasks':
            handleGetTasks();
            break;
        case '/investments':
            handleGetInvestments();
            break;
        case '/notifications':
            handleGetNotifications();
            break;
        case '/withdrawals':
            handleGetWithdrawals();
            break;
        case '/translations':
            handleGetTranslations();
            break;
        default:
            errorResponse('Endpoint not found', 404);
    }
}

function handlePutRequest($path) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($path) {
        case '/user/profile':
            handleUpdateProfile($input);
            break;
        case '/user/language':
            handleUpdateLanguage($input);
            break;
        default:
            errorResponse('Endpoint not found', 404);
    }
}

function handleDeleteRequest($path) {
    switch ($path) {
        case '/auth/logout':
            handleLogout();
            break;
        default:
            errorResponse('Endpoint not found', 404);
    }
}

// Authentication handlers
function handleLogin($input) {
    $phone = sanitizeInput($input['phone'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($phone) || empty($password)) {
        errorResponse('Phone and password are required');
    }
    
    $user = authenticateUser($phone, $password);
    if (!$user) {
        errorResponse('Invalid credentials');
    }
    
    // Generate JWT token
    $token = generateJWT([
        'user_id' => $user['id'],
        'exp' => time() + JWT_EXPIRY
    ]);
    
    // Set cookie
    setcookie('token', $token, time() + JWT_EXPIRY, '/', '', isProduction(), true);
    
    successResponse([
        'user' => [
            'id' => $user['id'],
            'phone' => $user['phone'],
            'name' => $user['name'],
            'email' => $user['email'],
            'wallet_balance' => $user['wallet_balance'],
            'bond_balance' => $user['bond_balance'],
            'total_earned' => $user['total_earned'],
            'level' => $user['level'],
            'is_admin' => $user['is_admin']
        ],
        'token' => $token
    ], 'Login successful!');
}

function handleRegister($input) {
    $phone = sanitizeInput($input['phone'] ?? '');
    $password = $input['password'] ?? '';
    $name = sanitizeInput($input['name'] ?? '');
    $email = sanitizeInput($input['email'] ?? '');
    $referralCode = sanitizeInput($input['referral_code'] ?? '');
    
    if (empty($phone) || empty($password)) {
        errorResponse('Phone and password are required');
    }
    
    // Validate phone number
    $validPhone = validatePhone($phone);
    if (!$validPhone) {
        errorResponse('Invalid phone number format');
    }
    
    $userId = createUser($validPhone, $password, $name, $email, $referralCode);
    if (!$userId) {
        errorResponse('User already exists or registration failed');
    }
    
    successResponse(['user_id' => $userId], 'Registration successful!');
}

function handleLogout() {
    setcookie('token', '', time() - 3600, '/');
    successResponse(null, 'Logout successful!');
}

// User handlers
function handleGetProfile() {
    $user = requireAuth();
    
    successResponse([
        'id' => $user['id'],
        'phone' => $user['phone'],
        'name' => $user['name'],
        'email' => $user['email'],
        'wallet_balance' => $user['wallet_balance'],
        'bond_balance' => $user['bond_balance'],
        'total_earned' => $user['total_earned'],
        'total_withdrawn' => $user['total_withdrawn'],
        'level' => $user['level'],
        'referral_code' => $user['referral_code'],
        'language' => $user['language']
    ]);
}

function handleGetUserStats() {
    $user = requireAuth();
    global $db;
    
    // Get today's earnings
    $todayEarnings = $db->fetch(
        "SELECT COALESCE(SUM(reward_earned), 0) as total FROM user_tasks 
         WHERE user_id = ? AND DATE(completed_at) = CURDATE()",
        [$user['id']]
    );
    
    // Get tasks completed today
    $tasksCompleted = $db->fetch(
        "SELECT COUNT(*) as count FROM user_tasks 
         WHERE user_id = ? AND DATE(completed_at) = CURDATE()",
        [$user['id']]
    );
    
    // Get this month's earnings
    $monthEarnings = $db->fetch(
        "SELECT COALESCE(SUM(reward_earned), 0) as total FROM user_tasks 
         WHERE user_id = ? AND MONTH(completed_at) = MONTH(CURDATE()) 
         AND YEAR(completed_at) = YEAR(CURDATE())",
        [$user['id']]
    );
    
    successResponse([
        'today_earnings' => (float)$todayEarnings['total'],
        'tasks_completed_today' => (int)$tasksCompleted['count'],
        'month_earnings' => (float)$monthEarnings['total'],
        'wallet_balance' => (float)$user['wallet_balance'],
        'bond_balance' => (float)$user['bond_balance'],
        'total_earned' => (float)$user['total_earned'],
        'total_withdrawn' => (float)$user['total_withdrawn']
    ]);
}

function handleUpdateProfile($input) {
    $user = requireAuth();
    global $db;
    
    $name = sanitizeInput($input['name'] ?? '');
    $email = sanitizeInput($input['email'] ?? '');
    
    $db->update(
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        [$name, $email, $user['id']]
    );
    
    successResponse(null, 'Profile updated successfully!');
}

function handleUpdateLanguage($input) {
    $user = requireAuth();
    global $db;
    
    $language = sanitizeInput($input['language'] ?? 'en');
    if (!in_array($language, ['en', 'sw', 'fr'])) {
        errorResponse('Invalid language');
    }
    
    $db->update(
        "UPDATE users SET language = ? WHERE id = ?",
        [$language, $user['id']]
    );
    
    successResponse(null, 'Language updated successfully!');
}

// Task handlers
function handleGetTasks() {
    $user = requireAuth();
    $tasks = getTasks($user['id']);
    
    successResponse($tasks);
}

function handleCompleteTask($input) {
    $user = requireAuth();
    $taskId = (int)($input['task_id'] ?? 0);
    
    if (!$taskId) {
        errorResponse('Task ID is required');
    }
    
    $reward = completeTask($user['id'], $taskId);
    if ($reward === false) {
        errorResponse('Task completion failed or already completed today');
    }
    
    successResponse([
        'reward' => $reward,
        'message' => 'Task completed successfully!'
    ]);
}

// Investment handlers
function handleCreateInvestment($input) {
    $user = requireAuth();
    
    $fundName = sanitizeInput($input['fund_name'] ?? '');
    $amount = (float)($input['amount'] ?? 0);
    $roiPercentage = (float)($input['roi_percentage'] ?? 0);
    $durationDays = (int)($input['duration_days'] ?? 0);
    $walletType = sanitizeInput($input['wallet_type'] ?? 'wallet');
    
    if (!$fundName || $amount <= 0 || $roiPercentage <= 0 || $durationDays <= 0) {
        errorResponse('Invalid investment parameters');
    }
    
    $investmentId = createInvestment($user['id'], $fundName, $amount, $roiPercentage, $durationDays, $walletType);
    if (!$investmentId) {
        errorResponse('Investment creation failed - insufficient balance');
    }
    
    successResponse(['investment_id' => $investmentId], 'Investment created successfully!');
}

function handleGetInvestments() {
    $user = requireAuth();
    global $db;
    
    $investments = $db->fetchAll(
        "SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC",
        [$user['id']]
    );
    
    successResponse($investments);
}

// Notification handlers
function handleGetNotifications() {
    $user = requireAuth();
    $notifications = getNotifications($user['id']);
    
    successResponse($notifications);
}

// Withdrawal handlers
function handleWithdrawalRequest($input) {
    $user = requireAuth();
    global $db;
    
    $amount = (float)($input['amount'] ?? 0);
    $method = sanitizeInput($input['method'] ?? '');
    $accountDetails = sanitizeInput($input['account_details'] ?? '');
    
    if ($amount <= 0 || $amount > $user['wallet_balance']) {
        errorResponse('Invalid withdrawal amount');
    }
    
    if (empty($method)) {
        errorResponse('Withdrawal method is required');
    }
    
    $withdrawalId = $db->insert(
        "INSERT INTO withdrawals (user_id, amount, method, account_details) VALUES (?, ?, ?, ?)",
        [$user['id'], $amount, $method, $accountDetails]
    );
    
    // Deduct from wallet
    $db->update(
        "UPDATE users SET wallet_balance = wallet_balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?",
        [$amount, $amount, $user['id']]
    );
    
    successResponse(['withdrawal_id' => $withdrawalId], 'Withdrawal request submitted successfully!');
}

function handleGetWithdrawals() {
    $user = requireAuth();
    global $db;
    
    $withdrawals = $db->fetchAll(
        "SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC",
        [$user['id']]
    );
    
    successResponse($withdrawals);
}

// Translation handlers
function handleGetTranslations() {
    $user = getCurrentUser();
    $language = $user ? getLanguage($user['id']) : 'en';
    $translations = getTranslations($language);
    
    successResponse($translations);
}

// M-PESA handlers (placeholder)
function handleMpesaRecharge($input) {
    $user = requireAuth();
    $amount = (float)($input['amount'] ?? 0);
    
    if ($amount <= 0) {
        errorResponse('Invalid recharge amount');
    }
    
    // This would integrate with M-PESA API
    // For now, just return a placeholder response
    successResponse([
        'transaction_id' => 'MPESA_' . time(),
        'status' => 'pending',
        'message' => 'M-PESA integration coming soon!'
    ]);
}
?> 