# UAI Agency - Usage Guide

## 🎯 How to Use the PHP Application

### 📋 Quick Start (5 Minutes)

1. **Set up database**:
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE uai_agency;
   CREATE USER 'uai_user'@'localhost' IDENTIFIED BY 'password123';
   GRANT ALL PRIVILEGES ON uai_agency.* TO 'uai_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

2. **Configure environment**:
   ```bash
   # Create .env file
   echo "DB_HOST=localhost
   DB_USER=uai_user
   DB_PASSWORD=password123
   DB_NAME=uai_agency
   APP_ENV=development
   JWT_SECRET=your-secret-key-here" > .env
   ```

3. **Run database migration**:
   ```bash
   php migrate-to-mysql.php
   ```

4. **Start server**:
   ```bash
   php -S localhost:8000
   ```

5. **Visit application**:
   - Open: `http://localhost:8000`
   - Register a new account
   - Start using the features!

## 🏗️ Application Structure

```
uai-agency-php/
├── index.php                 # Main entry point
├── config/
│   ├── database.php          # Database connection
│   └── config.php            # App configuration
├── includes/
│   └── functions.php         # Core functions
├── api/
│   └── router.php            # API endpoints
├── public/                   # Frontend files
├── .env                      # Environment variables
├── .htaccess                 # Apache config
└── migrate-to-mysql.php      # Database setup
```

## 🚀 How It Works

### 1. **User Registration & Login**
- Users register with phone number and password
- JWT-based authentication
- Multi-language support (English, Swahili, French)

### 2. **Task Management System**
- Users complete daily tasks to earn money
- Tasks include: surveys, video watching, social sharing
- Each task has a reward amount
- Users can only complete each task once per day

### 3. **Investment System**
- Users can invest their earnings
- Different investment funds with varying ROI
- Automatic payout processing when investments mature
- Support for both wallet and bond investments

### 4. **Withdrawal System**
- Users can request withdrawals
- Multiple payment methods supported
- Admin approval process
- Automatic balance deduction

### 5. **Admin Panel**
- Manage users, tasks, and investments
- Process withdrawal requests
- View system statistics
- Access: `/admin` (username: admin, password: admin123)

## 📱 API Endpoints

### Authentication
```bash
# Register
POST /api/auth/register
{
  "phone": "254700000000",
  "password": "password123",
  "name": "John Doe",
  "email": "john@example.com"
}

# Login
POST /api/auth/login
{
  "phone": "254700000000",
  "password": "password123"
}
```

### User Management
```bash
# Get user profile
GET /api/user/profile

# Get user statistics
GET /api/user/stats

# Update profile
PUT /api/user/profile
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Tasks
```bash
# Get available tasks
GET /api/tasks

# Complete a task
POST /api/tasks/complete
{
  "task_id": 1
}
```

### Investments
```bash
# Get user investments
GET /api/investments

# Create investment
POST /api/investments/create
{
  "fund_name": "Growth Fund",
  "amount": 1000.00,
  "roi_percentage": 5.0,
  "duration_days": 30,
  "wallet_type": "wallet"
}
```

### Withdrawals
```bash
# Get withdrawal history
GET /api/withdrawals

# Request withdrawal
POST /api/withdrawals/request
{
  "amount": 500.00,
  "method": "mpesa",
  "account_details": "254700000000"
}
```

## 💰 Business Model

### Revenue Streams
1. **Task Completion**: Users earn money by completing tasks
2. **Investment Returns**: Users invest and earn interest
3. **Referral System**: Users earn from referring friends
4. **Premium Features**: Advanced features for premium users

### User Journey
1. **Registration**: User signs up with phone number
2. **Task Completion**: User completes daily tasks to earn
3. **Investment**: User invests earnings for higher returns
4. **Withdrawal**: User withdraws money when needed
5. **Referrals**: User invites friends to earn bonuses

## 🔧 Customization

### Adding New Tasks
```php
// In migrate-to-mysql.php, add to $sampleTasks array:
['New Task Name', 'Task description', 10.00, 'daily']
```

### Modifying Investment Funds
```php
// Create new investment options in the frontend
{
  "fund_name": "Premium Fund",
  "roi_percentage": 8.0,
  "duration_days": 60,
  "min_amount": 5000.00
}
```

### Adding Payment Methods
```php
// In api/router.php, add new withdrawal methods
case 'new_payment_method':
    // Handle new payment method
    break;
```

## 🌐 Deployment Options

### Option 1: Shared Hosting (Easiest)
1. **Hostinger, Bluehost, SiteGround**
2. Upload files via FTP
3. Create MySQL database
4. Configure `.env` file
5. Run migration script

### Option 2: VPS/Dedicated Server
1. Install LAMP stack
2. Configure web server
3. Set up SSL certificate
4. Deploy application

### Option 3: Cloud Platforms
1. **Heroku**: Add MySQL addon
2. **DigitalOcean**: App Platform
3. **AWS**: EC2 with RDS

## 📊 Monitoring & Analytics

### Key Metrics to Track
- **User Registration**: Daily new users
- **Task Completion**: Tasks completed per day
- **Investment Activity**: Total investments and returns
- **Withdrawal Requests**: Processing time and success rate
- **Revenue**: Total earnings and platform fees

### Admin Dashboard Features
- User management and statistics
- Task performance analytics
- Investment portfolio tracking
- Withdrawal request processing
- System health monitoring

## 🔒 Security Features

### Built-in Security
- **JWT Authentication**: Secure token-based auth
- **Input Sanitization**: All user inputs are cleaned
- **SQL Injection Protection**: Prepared statements
- **XSS Protection**: Output escaping
- **CSRF Protection**: Token validation
- **Rate Limiting**: API request throttling

### Best Practices
- Use HTTPS in production
- Regular database backups
- Monitor error logs
- Keep dependencies updated
- Implement proper file permissions

## 🎯 Use Cases

### For Users
- **Earn Money**: Complete tasks and earn daily income
- **Invest Smart**: Grow money through investments
- **Refer Friends**: Earn bonuses for referrals
- **Withdraw Easily**: Get paid through multiple methods

### For Admins
- **Manage Platform**: Control tasks, users, and investments
- **Monitor Performance**: Track key metrics and analytics
- **Process Payments**: Handle withdrawal requests
- **Scale Business**: Add new features and payment methods

## 🚀 Getting Started Checklist

- [ ] Set up MySQL database
- [ ] Configure environment variables
- [ ] Run database migration
- [ ] Test local development
- [ ] Deploy to hosting
- [ ] Configure SSL certificate
- [ ] Set up monitoring
- [ ] Launch application

## 📞 Support

- **Documentation**: Check the code comments
- **Issues**: Review error logs
- **Customization**: Modify the PHP files as needed
- **Deployment**: Follow the deployment guide

## 🎉 Success Metrics

- **User Engagement**: Daily active users
- **Revenue Growth**: Monthly recurring revenue
- **Task Completion**: Average tasks per user
- **Investment Rate**: Percentage of users investing
- **Withdrawal Success**: Successful payment processing

Your UAI Agency application is now ready to help users earn money through tasks and investments! 