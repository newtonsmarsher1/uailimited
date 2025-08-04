// Global Language Manager
class LanguageManager {
  constructor() {
    this.currentLang = 'en';
    this.translations = {};
    this.initialized = false;
  }

  // Initialize the language manager
  async init() {
    if (this.initialized) return;
    
    // Load user's saved language preference
    const savedLang = localStorage.getItem('userLanguage');
    if (savedLang) {
      this.currentLang = savedLang;
    } else {
      // Get language from server if no saved preference
      await this.loadUserLanguage();
    }
    
    // Load translations
    await this.loadTranslations();
    
    // Apply language to current page
    this.applyLanguage();
    
    this.initialized = true;
    console.log('🌍 Language Manager initialized with:', this.currentLang);
  }

  // Load user's language from server
  async loadUserLanguage() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/get-lang', {
        headers: { Authorization: "Bearer " + token }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.currentLang = data.lang || 'en';
        localStorage.setItem('userLanguage', this.currentLang);
      }
    } catch (error) {
      console.error('Error loading user language:', error);
    }
  }

  // Load all translations
  async loadTranslations() {
    this.translations = {
      'en': {
        // Navigation
        'nav-home-label': 'Home',
        'nav-task-label': 'Task',
        'nav-team-label': 'Team Management',
        'nav-level-label': 'Level',
        'nav-profile-label': 'Profile',
        'team-management-title': 'Team Management',
        
        // Home page
        'welcome-msg': 'Welcome to UAI',
        'start-msg': 'Start your work journey',
        'company-activities-label': 'Company Activities',
        'news-label': 'News',
        'benefits-label': 'Member Benefits',
        'positions-label': 'Advertising Positions',
        'team-expansion-label': 'Team Expansion',
        'financial-management-label': 'UAI wealth fund',
        'casino-btn-label': 'Click here to enter the casino',
        
        // Profile page
        'profile-title': 'Profile',
        'wallet-balance-label': 'Wallet Balance',
        'profit-label': 'Profit',
        'tasks-done-label': 'Tasks Done',
        'bond-label': 'Bond',
        'logout-btn': 'Log Out',
        'language-select-label': 'Select Language',
        'notification-label': 'Notification',
        'withdraw-label': 'Withdraw',
        'bind-details-label': 'Bind Withdrawal Details',
        'privacy-policy-label': 'Privacy Policy',
        
        // Task page
        'task-list-title': 'Task list',
        'ongoing-label': 'Ongoing',
        'all-label': 'All',
        'completed-label': 'Completed',
        'install-btn': 'Install',
        'completed-btn': 'Completed',
        'upgrade-required-btn': 'Upgrade Required',
        'downloading-btn': 'Downloading...',
        
        // Level page
        'level-title': 'Level',
        'choose-level-btn': 'Choose this level',
        'level-locked': 'Level Locked',
        'upgrade-info-title': '💰 Upgrade Information',
        'remaining-tasks-label': 'Remaining tasks:',
        'completed-tasks-label': 'Completed tasks:',
        'cost-label': 'Cost',
        'level-locked': 'Level Locked',
        'promotion-tasks-title': 'Number of promotion tasks and commission income per day',
        'time-unit-label': 'Time unit',
        'number-of-tasks-label': 'Number of tasks',
        'total-commission-label': 'Total commission',
        'daily-label': 'Daily',
        'invitation-commission-title': 'Invitation commission profit margin',
        'invitation-method-label': 'Invitation Method',
        'invitation-rate-label': 'Invitation commission rate',
        'income-amount-label': 'Income amount',
        'task-commission-title': 'Task commission income ratio',
        'task-completion-label': 'Task completion from',
        'task-commission-ratio-label': 'Task commission ratio',
        'new-user-upgrade': 'New user upgrade to Level',
        'already-at-level': 'You are already at Level',
        'downgrade-from': 'Downgrade from Level',
        'upgrade-from': 'Upgrade from Level',
        'refund-amount': '💰 Refund: KES',
        'net-cost': '💳 Net cost: KES',
        'your-balance': '💵 Your balance: KES',
        'insufficient-balance': '❌ Insufficient balance (need KES',
        'sufficient-balance': '✅ Sufficient balance',
        'from-level': 'from Level',
        
        // Common
        'loading': 'Loading...',
        'error': 'Error',
        'success': 'Success',
        'network-error': 'Network error! Please try again.',
        'please-login': 'Please log in first',
        'failed-to-load': 'Failed to load data',
        'upgrade-success': 'Successfully upgraded to Level',
        'cost-label': 'Cost: KES',
        'refund-label': 'Refund: KES',
        'net-cost-label': 'Net cost: KES',
        'to-level': 'to Level',
        'new-user-upgrade': 'New user upgrade to Level',
        'already-at-level': 'You are already at Level',
        'downgrade-from': 'Downgrade from Level',
        'upgrade-from': 'Upgrade from Level',
        'insufficient-balance': 'Insufficient balance (need KES',
        'sufficient-balance': 'Sufficient balance',
        'upgrade-info-title': '💰 Upgrade Information'
      },
      'sw': {
        // Navigation
        'nav-home-label': 'Nyumbani',
        'nav-task-label': 'Kazi',
        'nav-team-label': 'Usimamizi wa Timu',
        'nav-level-label': 'Kiwango',
        'nav-profile-label': 'Wasifu',
        'team-management-title': 'Usimamizi wa Timu',
        
        // Home page
        'welcome-msg': 'Karibu kwenye UAI',
        'start-msg': 'Anza safari yako ya kazi',
        'company-activities-label': 'Shughuli za Kampuni',
        'news-label': 'Habari',
        'benefits-label': 'Faida za Wanachama',
        'positions-label': 'Nafasi za Matangazo',
        'team-expansion-label': 'Upanuzi wa Timu',
        'financial-management-label': 'Mfuko wa Uchumi wa UAI',
        'casino-btn-label': 'Bofya hapa kuingia kwenye kasino',
        
        // Profile page
        'profile-title': 'Wasifu',
        'wallet-balance-label': 'Salio la Wallet',
        'profit-label': 'Faida',
        'tasks-done-label': 'Kazi Zilizofanywa',
        'bond-label': 'Bond',
        'logout-btn': 'Toka',
        'language-select-label': 'Chagua Lugha',
        'notification-label': 'Arifa',
        'withdraw-label': 'Toa',
        'bind-details-label': 'Weka Maelezo ya Uondoaji',
        'privacy-policy-label': 'Sera ya Faragha',
        
        // Task page
        'task-list-title': 'Orodha ya kazi',
        'ongoing-label': 'Inaendelea',
        'all-label': 'Zote',
        'completed-label': 'Zilizokamilika',
        'install-btn': 'Sakinisha',
        'completed-btn': 'Imekamilika',
        'upgrade-required-btn': 'Inahitaji kufuzu',
        'downloading-btn': 'Inapakua...',
        
        // Level page
        'level-title': 'Kiwango',
        'choose-level-btn': 'Chagua kiwango hiki',
        'level-locked': 'Kiwango Kimefungwa',
        'upgrade-info-title': '💰 Maelezo ya Kufuzu',
        'remaining-tasks-label': 'Kazi zilizobaki:',
        'completed-tasks-label': 'Kazi zilizokamilika:',
        'cost-label': 'Gharama',
        'level-locked': 'Kiwango Kimefungwa',
        'promotion-tasks-title': 'Idadi ya kazi za kukuza na mapato ya komishoni kwa siku',
        'time-unit-label': 'Kipimo cha muda',
        'number-of-tasks-label': 'Idadi ya kazi',
        'total-commission-label': 'Jumla ya komishoni',
        'daily-label': 'Kwa siku',
        'invitation-commission-title': 'Faida ya komishoni ya mialiko',
        'invitation-method-label': 'Njia ya Mialiko',
        'invitation-rate-label': 'Kiwango cha komishoni ya mialiko',
        'income-amount-label': 'Kiasi cha mapato',
        'task-commission-title': 'Kiwango cha mapato ya komishoni ya kazi',
        'task-completion-label': 'Kukamilika kwa kazi kutoka',
        'task-commission-ratio-label': 'Kiwango cha komishoni ya kazi',
        'new-user-upgrade': 'Mpya kufuzu kwa Kiwango',
        'already-at-level': 'Uko tayari kwenye Kiwango',
        'downgrade-from': 'Kushuka kutoka Kiwango',
        'upgrade-from': 'Kufuzu kutoka Kiwango',
        'refund-amount': '💰 Rudi: KES',
        'net-cost': '💳 Gharama halisi: KES',
        'your-balance': '💵 Salio lako: KES',
        'insufficient-balance': '❌ Salio haitoshi (inahitaji KES',
        'sufficient-balance': '✅ Salio linalotosha',
        'from-level': 'kutoka Kiwango',
        
        // Common
        'loading': 'Inapakia...',
        'error': 'Hitilafu',
        'success': 'Mafanikio',
        'network-error': 'Hitilafu ya mtandao! Jaribu tena.',
        'please-login': 'Tafadhali ingia kwanza',
        'failed-to-load': 'Imeshindwa kupakia data',
        'upgrade-success': 'Imefuzu kwa mafanikio kwa Kiwango',
        'cost-label': 'Gharama: KES',
        'refund-label': 'Rudi: KES',
        'net-cost-label': 'Gharama halisi: KES',
        'to-level': 'kwa Kiwango',
        'new-user-upgrade': 'Mpya kufuzu kwa Kiwango',
        'already-at-level': 'Uko tayari kwenye Kiwango',
        'downgrade-from': 'Kushuka kutoka Kiwango',
        'upgrade-from': 'Kufuzu kutoka Kiwango',
        'insufficient-balance': 'Salio haitoshi (inahitaji KES',
        'sufficient-balance': 'Salio linalotosha',
        'upgrade-info-title': '💰 Maelezo ya Kufuzu'
      },
      'fr': {
        // Navigation
        'nav-home-label': 'Accueil',
        'nav-task-label': 'Tâches',
        'nav-team-label': 'Gestion d\'équipe',
        'nav-level-label': 'Niveau',
        'nav-profile-label': 'Profil',
        'team-management-title': 'Gestion d\'équipe',
        
        // Home page
        'welcome-msg': 'Bienvenue à UAI',
        'start-msg': 'Commencez votre parcours de travail',
        'company-activities-label': 'Activités de l\'entreprise',
        'news-label': 'Actualités',
        'benefits-label': 'Avantages des membres',
        'positions-label': 'Positions publicitaires',
        'team-expansion-label': 'Expansion de l\'équipe',
        'financial-management-label': 'Fonds de Richesse UAI',
        'casino-btn-label': 'Cliquez ici pour entrer au casino',
        
        // Profile page
        'profile-title': 'Profil',
        'wallet-balance-label': 'Solde du portefeuille',
        'profit-label': 'Profit',
        'tasks-done-label': 'Tâches terminées',
        'bond-label': 'Obligation',
        'logout-btn': 'Se déconnecter',
        'language-select-label': 'Sélectionner la langue',
        'notification-label': 'Notification',
        'withdraw-label': 'Retirer',
        'bind-details-label': 'Lier les détails de retrait',
        'privacy-policy-label': 'Politique de confidentialité',
        
        // Task page
        'task-list-title': 'Liste des tâches',
        'ongoing-label': 'En cours',
        'all-label': 'Tout',
        'completed-label': 'Terminé',
        'install-btn': 'Installer',
        'completed-btn': 'Terminé',
        'upgrade-required-btn': 'Mise à niveau requise',
        'downloading-btn': 'Téléchargement...',
        
        // Level page
        'level-title': 'Niveau',
        'choose-level-btn': 'Choisir ce niveau',
        'level-locked': 'Niveau verrouillé',
        'upgrade-info-title': '💰 Informations de mise à niveau',
        'remaining-tasks-label': 'Tâches restantes:',
        'completed-tasks-label': 'Tâches terminées:',
        'cost-label': 'Coût',
        'level-locked': 'Niveau verrouillé',
        'promotion-tasks-title': 'Nombre de tâches de promotion et revenus de commission par jour',
        'time-unit-label': 'Unité de temps',
        'number-of-tasks-label': 'Nombre de tâches',
        'total-commission-label': 'Commission totale',
        'daily-label': 'Quotidien',
        'invitation-commission-title': 'Marge de profit de commission d\'invitation',
        'invitation-method-label': 'Méthode d\'invitation',
        'invitation-rate-label': 'Taux de commission d\'invitation',
        'income-amount-label': 'Montant des revenus',
        'task-commission-title': 'Ratio de revenus de commission de tâches',
        'task-completion-label': 'Achèvement de tâches depuis',
        'task-commission-ratio-label': 'Ratio de commission de tâches',
        'new-user-upgrade': 'Nouvelle mise à niveau utilisateur vers le niveau',
        'already-at-level': 'Vous êtes déjà au niveau',
        'downgrade-from': 'Rétrograder du niveau',
        'upgrade-from': 'Mettre à niveau depuis le niveau',
        'refund-amount': '💰 Remboursement: KES',
        'net-cost': '💳 Coût net: KES',
        'your-balance': '💵 Votre solde: KES',
        'insufficient-balance': '❌ Solde insuffisant (nécessite KES',
        'sufficient-balance': '✅ Solde suffisant',
        'from-level': 'du niveau',
        
        // Common
        'loading': 'Chargement...',
        'error': 'Erreur',
        'success': 'Succès',
        'network-error': 'Erreur réseau! Veuillez réessayer.',
        'please-login': 'Veuillez vous connecter d\'abord',
        'failed-to-load': 'Échec du chargement des données',
        'upgrade-success': 'Mis à niveau avec succès vers le niveau',
        'cost-label': 'Coût: KES',
        'refund-label': 'Remboursement: KES',
        'net-cost-label': 'Coût net: KES',
        'to-level': 'vers le niveau',
        'new-user-upgrade': 'Nouvelle mise à niveau utilisateur vers le niveau',
        'already-at-level': 'Vous êtes déjà au niveau',
        'downgrade-from': 'Rétrograder du niveau',
        'upgrade-from': 'Mettre à niveau depuis le niveau',
        'insufficient-balance': 'Solde insuffisant (nécessite KES',
        'sufficient-balance': 'Solde suffisant',
        'upgrade-info-title': '💰 Informations de mise à niveau'
      }
    };
  }

  // Change language and save globally
  async changeLanguage(lang) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Save to server
      await fetch('/api/set-lang', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ lang: lang })
      });

      // Save locally
      this.currentLang = lang;
      localStorage.setItem('userLanguage', lang);
      
      // Apply new language
      this.applyLanguage();
      
      console.log('🌍 Language changed to:', lang);
      
      // Show success message
      this.showLanguageChangeMessage(lang);
      
    } catch (error) {
      console.error('Error changing language:', error);
    }
  }

  // Apply current language to all elements
  applyLanguage() {
    const currentTranslations = this.translations[this.currentLang] || this.translations['en'];
    
    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = currentTranslations[key];
      if (translation) {
        element.textContent = translation;
      }
    });

    // Update language chooser if it exists
    const languageChooser = document.getElementById('language-chooser');
    if (languageChooser) {
      languageChooser.value = this.currentLang;
    }

    // Update page title if it has a translation
    const titleKey = document.body.getAttribute('data-page-title');
    if (titleKey && currentTranslations[titleKey]) {
      document.title = currentTranslations[titleKey];
    }
  }

  // Get translation for a key
  getText(key) {
    const currentTranslations = this.translations[this.currentLang] || this.translations['en'];
    return currentTranslations[key] || key;
  }

  // Show language change success message
  showLanguageChangeMessage(lang) {
    const langNames = {
      'en': 'English',
      'sw': 'Swahili',
      'fr': 'French'
    };
    
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    `;
    
    message.textContent = `🌍 Language changed to ${langNames[lang] || lang}`;
    
    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(message);
    
    // Remove after 3 seconds
    setTimeout(() => {
      message.remove();
      style.remove();
    }, 3000);
  }

  // Auto-apply language when page loads
  static async autoInit() {
    if (!window.languageManager) {
      window.languageManager = new LanguageManager();
    }
    await window.languageManager.init();
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LanguageManager.autoInit();
});

// Export for use in other scripts
window.LanguageManager = LanguageManager; 