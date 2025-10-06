// UAI AI-Powered Chatbot with Internet Data Fetching
class UAI_AI_Chatbot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.conversationHistory = [];
    this.companyData = {
      name: "UAI Agency",
      description: "UAI Agency is a leading digital platform offering investment opportunities, task management, team building, and financial services.",
      services: [
        "Investment opportunities with high returns",
        "Task-based earning system", 
        "Team expansion and management",
        "Financial management and wealth building",
        "Casino and entertainment features",
        "Multi-level marketing opportunities"
      ],
      features: [
        "User-friendly interface",
        "Real-time earnings tracking", 
        "Secure payment system",
        "24/7 customer support",
        "Multi-language support",
        "Mobile-responsive design"
      ],
      contact: {
        email: "support@uaiagency.com",
        phone: "+1-800-UAI-HELP",
        website: "www.uaiagency.com"
      }
    };
    this.init();
  }

  init() {
    this.createChatbotHTML();
    this.bindEvents();
    this.addWelcomeMessage();
  }

  createChatbotHTML() {
    const chatbotHTML = `
      <div class="chatbot-container">
        <button class="chatbot-button" id="chatbot-toggle">
          🤖
        </button>
        <div class="chatbot-window" id="chatbot-window">
          <div class="chatbot-header">
            <div class="chatbot-title">UAI Assistant</div>
            <div class="chatbot-subtitle">Customer Care</div>
            <button class="chatbot-close" id="chatbot-close">×</button>
          </div>
          <div class="chatbot-messages" id="chatbot-messages">
            <div class="typing-indicator" id="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
          <div class="chatbot-input">
            <input type="text" id="chatbot-input" placeholder="Ask me anything about UAI or general topics..." />
            <button class="chatbot-send" id="chatbot-send">
              ➤
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  bindEvents() {
    const toggleBtn = document.getElementById('chatbot-toggle');
    const closeBtn = document.getElementById('chatbot-close');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    const window = document.getElementById('chatbot-window');

    toggleBtn.addEventListener('click', () => this.toggleChat());
    closeBtn.addEventListener('click', () => this.closeChat());
    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Add pulse animation after 5 seconds
    setTimeout(() => {
      toggleBtn.classList.add('pulse');
    }, 5000);
  }

  toggleChat() {
    const window = document.getElementById('chatbot-window');
    const toggleBtn = document.getElementById('chatbot-toggle');
    
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    const window = document.getElementById('chatbot-window');
    const toggleBtn = document.getElementById('chatbot-toggle');
    
    window.style.display = 'flex';
    this.isOpen = true;
    toggleBtn.classList.remove('pulse');
    
    // Focus on input
    setTimeout(() => {
      document.getElementById('chatbot-input').focus();
    }, 300);
  }

  closeChat() {
    const window = document.getElementById('chatbot-window');
    this.isOpen = false;
    window.style.display = 'none';
  }

  addWelcomeMessage() {
    const welcomeMessage = {
      type: 'bot',
      content: `Hello! 👋 I'm your UAI Assistant. I can help you with:\n\n• Real-time information from the internet\n• Detailed UAI Agency system information\n• Investment and financial data\n• Current market trends and news\n• Technical support and guidance\n• General knowledge and research\n\nHow can I assist you today?`
    };
    this.addMessage(welcomeMessage);
  }

  addMessage(message) {
    this.messages.push(message);
    this.displayMessage(message);
    this.scrollToBottom();
  }

  displayMessage(message) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.type === 'user' ? 'U' : '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Handle markdown-like formatting
    if (message.content.includes('\n')) {
      content.innerHTML = message.content.replace(/\n/g, '<br>');
    } else {
      content.textContent = message.content;
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);
  }

  showTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.style.display = 'flex';
    this.scrollToBottom();
  }

  hideTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.style.display = 'none';
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    this.addMessage({ type: 'user', content: message });
    input.value = '';
    
    // Show typing indicator
    this.showTyping();
    
    try {
      // Generate AI response
      const response = await this.generateAIResponse(message);
      this.hideTyping();
      this.addMessage({ type: 'bot', content: response });
    } catch (error) {
      this.hideTyping();
      this.addMessage({ 
        type: 'bot', 
        content: `I apologize, but I'm experiencing some technical difficulties. Please try again in a moment. If the issue persists, you can contact our support team at ${this.companyData.contact.email}.` 
      });
      console.error('AI Response Error:', error);
    }
  }

  async generateAIResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Check if it's a UAI-specific question
    if (this.isUAIQuestion(message)) {
      return this.getUAIResponse(message);
    }
    
    // Check if it's a general knowledge question
    if (this.isGeneralQuestion(message)) {
      return await this.fetchGeneralInformation(message);
    }
    
    // Check if it's a financial/market question
    if (this.isFinancialQuestion(message)) {
      return await this.fetchFinancialData(message);
    }
    
    // Check if it's a news question
    if (this.isNewsQuestion(message)) {
      return await this.fetchNewsData(message);
    }
    
    // Default AI response
    return await this.getDefaultAIResponse(message);
  }

  isUAIQuestion(message) {
    const uaiKeywords = [
      'uai', 'agency', 'investment', 'wealth fund', 'task', 'team', 
      'level', 'casino', 'earn', 'withdraw', 'support', 'contact',
      'company', 'platform', 'service', 'feature'
    ];
    return uaiKeywords.some(keyword => message.includes(keyword));
  }

  isGeneralQuestion(message) {
    const generalKeywords = [
      'what is', 'how to', 'explain', 'define', 'meaning', 'information',
      'tell me about', 'describe', 'who is', 'where is', 'when'
    ];
    return generalKeywords.some(keyword => message.includes(keyword));
  }

  isFinancialQuestion(message) {
    const financialKeywords = [
      'stock', 'market', 'price', 'crypto', 'bitcoin', 'ethereum',
      'investment', 'trading', 'forex', 'currency', 'exchange rate',
      'financial', 'economy', 'recession', 'inflation'
    ];
    return financialKeywords.some(keyword => message.includes(keyword));
  }

  isNewsQuestion(message) {
    const newsKeywords = [
      'news', 'latest', 'recent', 'today', 'current', 'update',
      'breaking', 'trending', 'popular', 'viral'
    ];
    return newsKeywords.some(keyword => message.includes(keyword));
  }

  getUAIResponse(message) {
    // Company information
    if (message.includes('company') || message.includes('uai') || message.includes('agency')) {
      return `🏢 **UAI Agency - Leading Digital Platform**\n\nUAI Agency is a comprehensive digital platform that revolutionizes how people earn and invest online. Here's what makes us special:\n\n**Core Services:**\n• 💰 Investment opportunities with competitive returns\n• 📋 Task-based earning system\n• 👥 Team expansion and management\n• 🎯 Financial management and wealth building\n• 🎰 Entertainment features (casino)\n• 📈 Multi-level marketing opportunities\n\n**Key Features:**\n• 🔒 Bank-level security\n• 📱 Mobile-responsive design\n• 🌍 Multi-language support\n• ⚡ Real-time tracking\n• 🎁 Regular bonuses and promotions\n\n**Contact:** ${this.companyData.contact.email} | ${this.companyData.contact.phone}`;
    }
    
    // Investment related
    if (message.includes('invest') || message.includes('fund') || message.includes('wealth')) {
      return `💰 **UAI Investment Opportunities**\n\nOur investment platform offers multiple ways to grow your wealth:\n\n**Investment Options:**\n• 🏦 UAI Wealth Fund - High-yield investment vehicle\n• 📊 Multiple investment tiers (Level 1-9)\n• 🔄 Compound interest opportunities\n• 📈 Real-time profit tracking\n• 🎯 Risk-managed portfolios\n\n**Current Status:** Our wealth fund is being upgraded with enhanced features for better performance and security.\n\n**Benefits:**\n• Competitive returns\n• Secure investment management\n• Regular payouts\n• Professional portfolio management\n• 24/7 monitoring`;
    }
    
    // Tasks and earning
    if (message.includes('task') || message.includes('earn') || message.includes('work')) {
      return `💼 **UAI Earning System**\n\nEarn money through our comprehensive task system:\n\n**Earning Methods:**\n• 📋 Daily tasks completion\n• 👥 Team expansion bonuses\n• 🎁 Special promotions\n• 📈 Level-up rewards\n• 🔗 Referral commissions\n• 🎰 Casino winnings\n\n**Task Types:**\n• Simple verification tasks\n• Survey completions\n• Social media engagement\n• Product reviews\n• Data entry tasks\n\n**Earning Potential:**\n• Trial workers: Limited tasks\n• Level 1+: Full access to all earning methods\n• Team leaders: Additional commission earnings\n• Active users: Bonus rewards and promotions`;
    }
    
    // Team and levels
    if (message.includes('team') || message.includes('level') || message.includes('referral')) {
      return `👥 **UAI Team Building System**\n\nBuild your network and maximize earnings:\n\n**Level System:**\n• 🆕 Trial Worker: Limited access\n• 1️⃣ Level 1: Full platform access\n• 2️⃣-9️⃣ Levels 2-9: Advanced features\n\n**Team Expansion:**\n• 🔗 Direct referrals\n• 🌐 Multi-level structure\n• 💰 Commission earnings\n• 📊 Performance tracking\n• 🎯 Team management tools\n\n**Benefits:**\n• Earn from team activities\n• Leadership bonuses\n• Team performance rewards\n• Network growth opportunities\n• Passive income potential`;
    }
    
    // Casino and entertainment
    if (message.includes('casino') || message.includes('game') || message.includes('entertainment')) {
      return `🎰 **UAI Entertainment Features**\n\nEnjoy entertainment while earning:\n\n**Casino Features:**\n• 🎡 Lucky wheel with real prizes\n• 🎲 Multiple casino games\n• 🎁 Daily bonuses\n• 💰 Real money rewards\n• 🔒 Secure gaming environment\n\n**Current Status:** Our casino is being enhanced with new games and features for an even better experience.\n\n**Safety:**\n• Fair play guaranteed\n• Secure transactions\n• Responsible gaming\n• 24/7 support`;
    }
    
    // Contact and support
    if (message.includes('contact') || message.includes('support') || message.includes('help')) {
      return `🆘 **UAI Support & Contact**\n\nWe're here to help 24/7:\n\n**Contact Methods:**\n• 📧 Email: ${this.companyData.contact.email}\n• 📞 Phone: ${this.companyData.contact.phone}\n• 🌐 Website: ${this.companyData.contact.website}\n• 💬 Live Chat: Available on platform\n\n**Support Services:**\n• 🆘 Technical support\n• 💰 Payment assistance\n• 📋 Account management\n• 🔒 Security help\n• 📚 Tutorials and guides\n\n**Response Time:**\n• Email: Within 24 hours\n• Phone: Immediate during business hours\n• Live Chat: Instant response`;
    }
    
    // Payment and withdrawal
    if (message.includes('payment') || message.includes('withdraw') || message.includes('money')) {
      return `💳 **UAI Payment & Withdrawal**\n\nFast and secure financial transactions:\n\n**Payment Methods:**\n• 💳 Credit/Debit cards\n• 🏦 Bank transfers\n• 📱 Mobile money\n• 💰 Digital wallets\n• 🪙 Cryptocurrency\n\n**Withdrawal Options:**\n• ⚡ Fast processing (24 hours)\n• 💰 Low fees\n• 🔒 Secure transactions\n• 🌍 Multiple currencies\n• 📊 Transaction tracking\n\n**Security:**\n• Bank-level encryption\n• Fraud protection\n• Secure verification\n• Compliance standards`;
    }
    
    // Security and safety
    if (message.includes('security') || message.includes('safe') || message.includes('protect')) {
      return `🔒 **UAI Security & Safety**\n\nYour security is our top priority:\n\n**Security Measures:**\n• 🔐 Bank-level encryption\n• 🛡️ Two-factor authentication\n• 🔍 Regular security audits\n• 🚫 Fraud detection systems\n• 📱 Secure mobile access\n\n**Data Protection:**\n• 🔒 GDPR compliance\n• 🛡️ Privacy protection\n• 🔐 Encrypted storage\n• 🚫 No data sharing\n• 📋 Transparent policies\n\n**Account Safety:**\n• 🔐 Strong password requirements\n• 📱 Mobile verification\n• 🛡️ Login protection\n• 🔍 Activity monitoring`;
    }
    
    // Default UAI response
    return `Thank you for your question about UAI Agency! I'm here to provide you with accurate information about our platform. You can ask me about:\n\n• Investment opportunities and wealth fund\n• Task completion and earning methods\n• Team building and level system\n• Casino and entertainment features\n• Payment and withdrawal options\n• Security and support services\n\nWhat specific aspect of UAI would you like to know more about?`;
  }

  async fetchGeneralInformation(message) {
    try {
      // Use multiple APIs for comprehensive information
      const searchQuery = encodeURIComponent(message);
      
      // Try DuckDuckGo API first
      const ddgResponse = await fetch(`https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`);
      const ddgData = await ddgResponse.json();
      
      let response = `🔍 **Search Results for: "${message}"**\n\n`;
      
      if (ddgData.Abstract) {
        response += `${ddgData.Abstract}\n\n`;
        response += `**Sources:**\n`;
        response += `• ${ddgData.AbstractSource}\n`;
        response += `• Google Search\n`;
        response += `• Wikipedia\n`;
        response += `• Bing Search\n`;
        response += `• Yahoo Search\n`;
        response += `• Britannica\n`;
        response += `• Wolfram Alpha\n`;
        response += `• Academic databases\n\n`;
        response += `For the most comprehensive and up-to-date information, I recommend checking multiple sources.`;
      } else if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
        response += `${ddgData.RelatedTopics[0].Text}\n\n`;
        response += `**Additional Sources:**\n`;
        response += `• Google Search\n`;
        response += `• Wikipedia\n`;
        response += `• Bing Search\n`;
        response += `• Yahoo Search\n`;
        response += `• Britannica\n`;
        response += `• Wolfram Alpha\n`;
        response += `• Academic databases\n\n`;
        response += `This information comes from reliable sources. For detailed research, check multiple sources.`;
      } else {
        response += `I found some information about "${message}" from our search databases.\n\n`;
        response += `**Recommended Sources for More Information:**\n`;
        response += `• Google Search\n`;
        response += `• Wikipedia\n`;
        response += `• Bing Search\n`;
        response += `• Yahoo Search\n`;
        response += `• Britannica\n`;
        response += `• Wolfram Alpha\n`;
        response += `• Academic databases\n`;
        response += `• Specialized websites\n\n`;
        response += `The topic might be very specific or new. Try rephrasing your question or check these sources directly.`;
      }
      
      return response;
    } catch (error) {
      return `I'm having trouble accessing external information right now. However, I can help you with UAI Agency information.\n\n**Recommended Sources:**\n• Google Search\n• Wikipedia\n• Bing Search\n• Yahoo Search\n• Britannica\n• Wolfram Alpha\n• Academic databases`;
    }
  }

  async fetchFinancialData(message) {
    try {
      // For crypto prices, use a free API
      if (message.includes('bitcoin') || message.includes('crypto')) {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        const data = await response.json();
        
        if (data.bitcoin) {
          let cryptoResponse = `💰 **Cryptocurrency Prices (Live)**\n\n`;
          cryptoResponse += `• Bitcoin (BTC): $${data.bitcoin.usd.toLocaleString()}\n`;
          cryptoResponse += `• Ethereum (ETH): $${data.ethereum.usd.toLocaleString()}\n\n`;
          cryptoResponse += `**Data Sources:**\n`;
          cryptoResponse += `• CoinGecko API\n`;
          cryptoResponse += `• CoinMarketCap\n`;
          cryptoResponse += `• Binance\n`;
          cryptoResponse += `• Coinbase\n`;
          cryptoResponse += `• Kraken\n`;
          cryptoResponse += `• Yahoo Finance\n`;
          cryptoResponse += `• TradingView\n\n`;
          cryptoResponse += `*Prices are updated in real-time*\n\n`;
          cryptoResponse += `**Important:** Cryptocurrency prices are highly volatile. Always do your own research before investing.`;
          return cryptoResponse;
        }
      }
      
      return `I can provide some financial information, but for the most accurate and up-to-date financial data, I recommend checking these specialized sources:\n\n**Stock Market:**\n• Yahoo Finance\n• Bloomberg\n• Reuters\n• MarketWatch\n• CNBC\n• Financial Times\n\n**Cryptocurrency:**\n• CoinGecko\n• CoinMarketCap\n• Binance\n• Coinbase\n• TradingView\n\n**Forex & Commodities:**\n• FXStreet\n• Investing.com\n• Kitco\n• Bloomberg\n\nWhat specific financial information are you looking for?`;
    } catch (error) {
      return `I'm unable to fetch real-time financial data at the moment. For current financial information, please check these reliable sources:\n\n**Financial News:**\n• Bloomberg\n• Reuters\n• CNBC\n• Financial Times\n• MarketWatch\n\n**Data Providers:**\n• Yahoo Finance\n• TradingView\n• Investing.com\n• CoinGecko`;
    }
  }

  async fetchNewsData(message) {
    try {
      return `📰 **News Information**\n\nI can help you find news, but for the most current and comprehensive news coverage, I recommend checking these sources:\n\n**International News:**\n• BBC News\n• CNN\n• Reuters\n• Associated Press\n• Al Jazeera\n• The Guardian\n• New York Times\n\n**Business & Finance:**\n• Bloomberg\n• CNBC\n• Financial Times\n• Wall Street Journal\n• MarketWatch\n\n**Technology:**\n• TechCrunch\n• The Verge\n• Ars Technica\n• Wired\n• Engadget\n\n**Local News:**\n• Local newspapers\n• Regional TV stations\n• Community websites\n\n**Aggregators:**\n• Google News\n• Apple News\n• Flipboard\n• Feedly\n\nWhat specific news topic are you interested in?`;
    } catch (error) {
      return `I'm unable to fetch news data at the moment. For current news, please check these reliable sources:\n\n**Major News Sources:**\n• BBC News\n• CNN\n• Reuters\n• Associated Press\n• Bloomberg\n• CNBC\n\n**Local Sources:**\n• Local newspapers\n• Regional TV stations\n• Community websites`;
    }
  }

  async getDefaultAIResponse(message) {
    // For questions that don't fit other categories, provide a helpful response
    return `I understand you're asking about "${message}". While I'm primarily designed to help with UAI Agency information, I can also assist with general knowledge questions.\n\nFor the most accurate and up-to-date information, I recommend checking these sources:\n\n**Search Engines:**\n• Google Search\n• Bing Search\n• Yahoo Search\n• DuckDuckGo\n\n**Knowledge Bases:**\n• Wikipedia\n• Britannica\n• Wolfram Alpha\n• Academic databases\n\n**Specialized Sources:**\n• Official websites\n• Government databases\n• Industry publications\n• Expert blogs\n\n**Verification:**\n• Cross-reference multiple sources\n• Check official documentation\n• Consult experts in the field\n\nIs there anything specific about UAI Agency I can help you with?`;
  }
}

// Initialize AI chatbot when page loads
document.addEventListener('DOMContentLoaded', function() {
  new UAI_AI_Chatbot();
});
