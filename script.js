// Advanced Voice Calculator - Main JavaScript

class VoiceCalculator {
    constructor() {
        // Calculator State
        this.currentValue = '0';
        this.previousValue = '';
        this.operation = null;
        this.shouldResetDisplay = false;
        this.expression = '';
        this.history = [];
        this.currentMode = 'basic';
        this.currentBase = 10;
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        
        // Authentication State
        this.user = null;
        this.token = null;
        this.API_BASE = window.location.origin + '/api';
        
        // DOM Elements
        this.resultDisplay = document.getElementById('result');
        this.expressionDisplay = document.getElementById('expression');
        this.voiceFeedback = document.getElementById('voiceFeedback');
        this.feedbackText = document.getElementById('feedbackText');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.historyPanel = document.getElementById('historyPanel');
        this.historyList = document.getElementById('historyList');
        this.voiceHelp = document.getElementById('voiceHelp');
        
        // Initialize
        this.init();
    }
    
    init() {
        this.initSpeechRecognition();
        this.initEventListeners();
        this.initConverter();
        this.loadHistory();
        this.loadTheme();
        this.loadAuthState();
        this.initModals();
    }
    
    // ==================== AUTHENTICATION ====================
    
    loadAuthState() {
        const savedToken = localStorage.getItem('calculatorToken');
        const savedUser = localStorage.getItem('calculatorUser');
        
        if (savedToken && savedUser) {
            this.token = savedToken;
            this.user = JSON.parse(savedUser);
            this.updateAuthUI();
            this.fetchUserProfile();
        }
    }
    
    async fetchUserProfile() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.user = { ...this.user, ...data.user };
                localStorage.setItem('calculatorUser', JSON.stringify(this.user));
                this.updateAuthUI();
            } else if (response.status === 401 || response.status === 403) {
                this.logout();
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    }
    
    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('calculatorToken', this.token);
                localStorage.setItem('calculatorUser', JSON.stringify(this.user));
                this.updateAuthUI();
                this.closeModal('authModal');
                this.showToast('Login successful!', 'success');
                this.syncHistory();
            } else {
                this.showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Connection error. Please try again.', 'error');
        }
    }
    
    async register(username, email, password, displayName) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, displayName })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('calculatorToken', this.token);
                localStorage.setItem('calculatorUser', JSON.stringify(this.user));
                this.updateAuthUI();
                this.closeModal('authModal');
                this.showToast('Registration successful!', 'success');
            } else {
                this.showToast(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Connection error. Please try again.', 'error');
        }
    }
    
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('calculatorToken');
        localStorage.removeItem('calculatorUser');
        this.updateAuthUI();
        this.closeModal('profileModal');
        this.showToast('Logged out successfully', 'info');
    }
    
    updateAuthUI() {
        const userBtn = document.getElementById('userBtn');
        
        if (this.user) {
            userBtn.classList.add('logged-in');
            userBtn.title = this.user.displayName || this.user.username;
            
            // Update profile modal
            document.getElementById('profileName').textContent = this.user.displayName || this.user.username;
            document.getElementById('profileEmail').textContent = this.user.email;
            
            if (this.user.total_calculations !== undefined) {
                document.getElementById('statCalculations').textContent = this.user.total_calculations || 0;
                document.getElementById('statConversions').textContent = this.user.total_conversions || 0;
                document.getElementById('statVoiceCommands').textContent = this.user.total_voice_commands || 0;
                document.getElementById('statStreak').textContent = this.user.streak_days || 0;
            }
        } else {
            userBtn.classList.remove('logged-in');
            userBtn.title = 'Account';
        }
    }
    
    // ==================== API METHODS ====================
    
    async saveCalculationToServer(expression, result, mode) {
        if (!this.token) return;
        
        try {
            await fetch(`${this.API_BASE}/calculations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ expression, result: String(result), mode })
            });
        } catch (error) {
            console.error('Failed to save calculation:', error);
        }
    }
    
    async syncHistory() {
        if (!this.token) return;
        
        try {
            const response = await fetch(`${this.API_BASE}/calculations?limit=50`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Merge server history with local
                this.history = data.calculations.map(c => ({
                    expression: c.expression,
                    result: c.result,
                    timestamp: new Date(c.created_at).toLocaleTimeString()
                }));
                this.renderHistory();
            }
        } catch (error) {
            console.error('Failed to sync history:', error);
        }
    }
    
    async saveToFavorites(name, category, description) {
        if (!this.token) {
            this.showToast('Please login to save calculations', 'info');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/saved`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    name,
                    expression: this.expression || this.currentValue,
                    result: this.currentValue,
                    description,
                    category
                })
            });
            
            if (response.ok) {
                this.showToast('Calculation saved!', 'success');
                this.closeModal('saveModal');
            } else {
                this.showToast('Failed to save', 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showToast('Connection error', 'error');
        }
    }
    
    async loadSavedCalculations() {
        if (!this.token) return;
        
        try {
            const response = await fetch(`${this.API_BASE}/saved`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderSavedList(data.saved);
            }
        } catch (error) {
            console.error('Failed to load saved:', error);
        }
    }
    
    async deleteSaved(id) {
        try {
            const response = await fetch(`${this.API_BASE}/saved/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.showToast('Deleted successfully', 'success');
                this.loadSavedCalculations();
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
    
    async saveFormula(formulaData) {
        if (!this.token) {
            this.showToast('Please login to save formulas', 'info');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/formulas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(formulaData)
            });
            
            if (response.ok) {
                this.showToast('Formula saved!', 'success');
                this.closeModal('formulaModal');
            } else {
                this.showToast('Failed to save formula', 'error');
            }
        } catch (error) {
            console.error('Save formula error:', error);
            this.showToast('Connection error', 'error');
        }
    }
    
    async loadFormulas(isPublic = false) {
        const endpoint = isPublic ? '/formulas/public' : '/formulas';
        const headers = isPublic ? {} : { 'Authorization': `Bearer ${this.token}` };
        
        try {
            const response = await fetch(`${this.API_BASE}${endpoint}`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                if (isPublic) {
                    this.renderFormulasList(data.formulas, 'publicFormulasList');
                } else {
                    this.renderFormulasList(data.formulas, 'myFormulasList');
                }
            }
        } catch (error) {
            console.error('Failed to load formulas:', error);
        }
    }
    
    async deleteFormula(id) {
        try {
            const response = await fetch(`${this.API_BASE}/formulas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.showToast('Formula deleted', 'success');
                this.loadFormulas(false);
            }
        } catch (error) {
            console.error('Delete formula error:', error);
        }
    }
    
    async shareCalculation() {
        const expression = this.expression || this.currentValue;
        const result = this.currentValue;
        const expiresIn = document.getElementById('shareExpiry').value;
        
        try {
            const response = await fetch(`${this.API_BASE}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
                },
                body: JSON.stringify({
                    expression,
                    result,
                    mode: this.currentMode,
                    expiresIn: expiresIn ? parseInt(expiresIn) : null
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const shareUrl = `${window.location.origin}${data.shareUrl}`;
                document.getElementById('shareLink').value = shareUrl;
                document.getElementById('shareLinkContainer').classList.remove('hidden');
                this.showToast('Share link generated!', 'success');
            }
        } catch (error) {
            console.error('Share error:', error);
            this.showToast('Failed to generate share link', 'error');
        }
    }
    
    async logVoiceCommand(commandText, interpretedAs, success) {
        try {
            await fetch(`${this.API_BASE}/voice-commands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
                },
                body: JSON.stringify({ commandText, interpretedAs, success })
            });
        } catch (error) {
            console.error('Failed to log voice command:', error);
        }
    }
    
    // Speech Recognition Setup
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.voiceBtn.classList.add('listening');
                this.voiceStatus.textContent = 'Listening...';
                this.voiceFeedback.classList.add('listening');
                this.feedbackText.textContent = 'Listening...';
            };
            
            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                this.feedbackText.textContent = transcript;
                
                if (event.results[0].isFinal) {
                    this.processVoiceCommand(transcript.toLowerCase());
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopListening();
                this.logVoiceCommand(this.feedbackText.textContent, null, false);
                this.showToast('Voice recognition error. Please try again.', 'error');
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
        } else {
            this.voiceBtn.disabled = true;
            this.voiceStatus.textContent = 'Voice not supported';
            this.showToast('Voice recognition not supported in this browser', 'error');
        }
    }
    
    startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (e) {
                console.error('Recognition error:', e);
            }
        }
    }
    
    stopListening() {
        this.isListening = false;
        this.voiceBtn.classList.remove('listening');
        this.voiceStatus.textContent = 'Click to speak';
        this.voiceFeedback.classList.remove('listening');
    }
    
    // Voice Command Processing
    processVoiceCommand(command) {
        console.log('Processing command:', command);
        
        // Show what was heard to the user
        this.feedbackText.textContent = `Heard: "${command}"`;
        
        let interpreted = null;
        let success = true;
        
        // Help command
        if (command.includes('help') || command.includes('what can')) {
            this.showVoiceHelp();
            this.speak('Here are some things you can say: five plus three, square root of 16, clear, or switch to scientific mode');
            interpreted = 'help';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // Clear commands
        if (command.includes('clear') || command.includes('reset')) {
            this.clear();
            this.speak('Cleared');
            interpreted = 'clear';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // History commands
        if (command.includes('history') || command.includes('show history')) {
            this.toggleHistory();
            this.speak('Showing history');
            interpreted = 'show history';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // Undo command
        if (command.includes('undo') || command.includes('back')) {
            this.backspace();
            this.speak('Undone');
            interpreted = 'undo';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // Equals command
        if (command.includes('equals') || command.includes('calculate') || command.includes('result')) {
            this.calculate();
            interpreted = 'calculate';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // Mode switching
        if (command.includes('basic mode')) {
            this.switchMode('basic');
            this.speak('Switched to basic mode');
            interpreted = 'switch to basic mode';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        if (command.includes('scientific mode')) {
            this.switchMode('scientific');
            this.speak('Switched to scientific mode');
            interpreted = 'switch to scientific mode';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        if (command.includes('programmer mode')) {
            this.switchMode('programmer');
            this.speak('Switched to programmer mode');
            interpreted = 'switch to programmer mode';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        if (command.includes('converter') || command.includes('convert')) {
            this.switchMode('converter');
            this.speak('Switched to converter mode');
            interpreted = 'switch to converter mode';
            this.logVoiceCommand(command, interpreted, success);
            return;
        }
        
        // Parse mathematical expressions
        const result = this.parseVoiceExpression(command);
        if (result !== null) {
            // Show detailed feedback
            this.feedbackText.textContent = `${this.expression || command} = ${result}`;
            this.speak(`The answer is ${result}`);
            interpreted = 'mathematical calculation';
            this.logVoiceCommand(command, interpreted, success);
        } else {
            // Check if a number was entered
            if (this.result !== '0') {
                this.feedbackText.textContent = `Entered: ${this.result}`;
                interpreted = 'number input';
                this.logVoiceCommand(command, interpreted, true);
            } else {
                this.feedbackText.textContent = `Could not understand: "${command}"`;
                success = false;
                this.logVoiceCommand(command, null, success);
            }
        }
    }
    
    parseVoiceExpression(command) {
        console.log('Original command:', command);
        
        // Step 1: Normalize and clean the input
        let processedCommand = command.toLowerCase().trim();
        
        // Step 2: Fix common speech recognition errors
        // Sometimes "+" is heard as "plus" but sometimes literally as "+"
        const speechFixes = {
            // Operator fixes - handle when speech recognition outputs symbols
            '\\+': ' plus ',
            '\\-': ' minus ',
            '\\*': ' times ',
            '\\/': ' divided by ',
            '\\=': ' equals ',
            '×': ' times ',
            '÷': ' divided by ',
            // Common mishearing fixes
            'plus plus': 'plus',
            'add add': 'add',
            'what is': '',
            "what's": '',
            'calculate': '',
            'compute': '',
            'whats': '',
            'the answer to': '',
            'tell me': '',
            'can you': '',
            'please': '',
            // Fix for numbers sometimes heard wrong
            'to': 'two',  // Only in number context, handled later
            'for': 'four', // Only in number context, handled later
            'won': 'one',
            'too': 'two',
            'tree': 'three',
            'free': 'three',
            'ate': 'eight',
            'sex': 'six',
            'sax': 'six',
            'nein': 'nine',
            'knight': 'nine',
            'night': 'nine',
            'tin': 'ten',
            'tan': 'ten', // but not tangent
            'eleven': '11',
            'twelve': '12',
            'thirteen': '13',
            'fourteen': '14',
            'fifteen': '15',
            'sixteen': '16',
            'seventeen': '17',
            'eighteen': '18',
            'nineteen': '19',
        };
        
        // Apply speech fixes
        for (const [pattern, replacement] of Object.entries(speechFixes)) {
            processedCommand = processedCommand.replace(new RegExp(pattern, 'gi'), replacement);
        }
        
        // Step 3: Number words to digits mapping (comprehensive)
        const numberWords = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
            'ten': '10', 'twenty': '20', 'thirty': '30', 'forty': '40', 
            'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 
            'ninety': '90', 'hundred': '100', 'thousand': '1000',
            'million': '1000000', 'billion': '1000000000',
            // Common compound numbers
            'twenty one': '21', 'twenty two': '22', 'twenty three': '23',
            'twenty four': '24', 'twenty five': '25', 'twenty six': '26',
            'twenty seven': '27', 'twenty eight': '28', 'twenty nine': '29',
            'thirty one': '31', 'thirty two': '32', 'thirty three': '33',
            'forty five': '45', 'fifty five': '55', 'sixty six': '66',
            'seventy seven': '77', 'eighty eight': '88', 'ninety nine': '99',
        };
        
        // Replace compound numbers first (longer phrases)
        const sortedNumberWords = Object.entries(numberWords).sort((a, b) => b[0].length - a[0].length);
        for (const [word, digit] of sortedNumberWords) {
            processedCommand = processedCommand.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
        }
        
        // Step 4: Handle "X hundred Y" patterns like "one hundred twenty three"
        processedCommand = processedCommand.replace(/(\d+)\s*hundred\s*(?:and\s*)?(\d+)/gi, (match, h, n) => {
            return String(parseInt(h) * 100 + parseInt(n));
        });
        processedCommand = processedCommand.replace(/(\d+)\s*hundred/gi, (match, h) => {
            return String(parseInt(h) * 100);
        });
        processedCommand = processedCommand.replace(/(\d+)\s*thousand\s*(?:and\s*)?(\d+)/gi, (match, t, n) => {
            return String(parseInt(t) * 1000 + parseInt(n));
        });
        processedCommand = processedCommand.replace(/(\d+)\s*thousand/gi, (match, t) => {
            return String(parseInt(t) * 1000);
        });
        
        // Step 5: Normalize operator words
        const operatorNormalization = [
            { patterns: ['plus', 'add', 'added to', 'and', 'with', 'sum'], op: ' plus ' },
            { patterns: ['minus', 'subtract', 'subtracted', 'take away', 'less', 'negative'], op: ' minus ' },
            { patterns: ['times', 'multiplied by', 'multiply by', 'multiply', 'x', 'into'], op: ' times ' },
            { patterns: ['divided by', 'divide by', 'divide', 'over', 'by'], op: ' divided by ' },
        ];
        
        for (const { patterns, op } of operatorNormalization) {
            for (const pattern of patterns) {
                // Avoid replacing "by" when it's part of "multiplied by" or "divided by"
                if (pattern === 'by') {
                    processedCommand = processedCommand.replace(/\s+by\s+(?!\d)/gi, op);
                } else {
                    processedCommand = processedCommand.replace(new RegExp(`\\s*${pattern}\\s*`, 'gi'), op);
                }
            }
        }
        
        // Clean up multiple spaces
        processedCommand = processedCommand.replace(/\s+/g, ' ').trim();
        
        console.log('Processed command:', processedCommand);
        
        // Step 6: Try to extract calculation patterns
        
        // Scientific functions first
        const scientificPatterns = [
            { pattern: /square\s*root\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.sqrt(parseFloat(m[1])), name: 'sqrt' },
            { pattern: /sqrt\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.sqrt(parseFloat(m[1])), name: 'sqrt' },
            { pattern: /cube\s*root\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.cbrt(parseFloat(m[1])), name: 'cbrt' },
            { pattern: /(\d+\.?\d*)\s*squared/i, fn: (m) => Math.pow(parseFloat(m[1]), 2), name: 'square' },
            { pattern: /square\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), 2), name: 'square' },
            { pattern: /(\d+\.?\d*)\s*cubed/i, fn: (m) => Math.pow(parseFloat(m[1]), 3), name: 'cube' },
            { pattern: /cube\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), 3), name: 'cube' },
            { pattern: /(\d+\.?\d*)\s*(?:to the power of|power|raised to|exponent)\s*(\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), parseFloat(m[2])), name: 'power' },
            { pattern: /(\d+\.?\d*)\s*\^\s*(\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), parseFloat(m[2])), name: 'power' },
            { pattern: /sine?\s*(?:of\s*)?(\d+\.?\d*)\s*(?:degrees?)?/i, fn: (m) => Math.sin(parseFloat(m[1]) * Math.PI / 180), name: 'sin' },
            { pattern: /cosine?\s*(?:of\s*)?(\d+\.?\d*)\s*(?:degrees?)?/i, fn: (m) => Math.cos(parseFloat(m[1]) * Math.PI / 180), name: 'cos' },
            { pattern: /tan(?:gent)?\s*(?:of\s*)?(\d+\.?\d*)\s*(?:degrees?)?/i, fn: (m) => Math.tan(parseFloat(m[1]) * Math.PI / 180), name: 'tan' },
            { pattern: /log(?:arithm)?\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.log10(parseFloat(m[1])), name: 'log' },
            { pattern: /natural\s*log\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.log(parseFloat(m[1])), name: 'ln' },
            { pattern: /ln\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => Math.log(parseFloat(m[1])), name: 'ln' },
            { pattern: /(\d+\.?\d*)\s*factorial/i, fn: (m) => this.factorial(parseInt(m[1])), name: 'factorial' },
            { pattern: /factorial\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => this.factorial(parseInt(m[1])), name: 'factorial' },
            { pattern: /absolute\s*(?:value\s*)?(?:of\s*)?(-?\d+\.?\d*)/i, fn: (m) => Math.abs(parseFloat(m[1])), name: 'abs' },
            { pattern: /(\d+\.?\d*)\s*percent\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => (parseFloat(m[1]) / 100) * parseFloat(m[2]), name: 'percent' },
            { pattern: /percentage\s*(?:of\s*)?(\d+\.?\d*)\s*(?:of\s*)?(\d+\.?\d*)/i, fn: (m) => (parseFloat(m[1]) / 100) * parseFloat(m[2]), name: 'percent' },
        ];
        
        for (const { pattern, fn, name } of scientificPatterns) {
            const match = processedCommand.match(pattern);
            if (match) {
                try {
                    const result = fn(match);
                    if (!isNaN(result) && isFinite(result)) {
                        this.setResult(result);
                        this.addToHistory(`${name}(${match[1]})`, result);
                        return result;
                    }
                } catch (e) {
                    console.error('Scientific calculation error:', e);
                }
            }
        }
        
        // Basic arithmetic - multiple pattern approaches
        // Pattern 1: "X plus Y", "X times Y", etc.
        const arithmeticPatterns = [
            // Addition patterns
            { pattern: /(\d+\.?\d*)\s*plus\s*(\d+\.?\d*)/i, op: '+' },
            { pattern: /(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)/i, op: '+' },
            // Subtraction patterns  
            { pattern: /(\d+\.?\d*)\s*minus\s*(\d+\.?\d*)/i, op: '-' },
            { pattern: /(\d+\.?\d*)\s*\-\s*(\d+\.?\d*)/i, op: '-' },
            // Multiplication patterns
            { pattern: /(\d+\.?\d*)\s*times\s*(\d+\.?\d*)/i, op: '*' },
            { pattern: /(\d+\.?\d*)\s*\*\s*(\d+\.?\d*)/i, op: '*' },
            { pattern: /(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i, op: '*' },
            // Division patterns
            { pattern: /(\d+\.?\d*)\s*divided by\s*(\d+\.?\d*)/i, op: '/' },
            { pattern: /(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/i, op: '/' },
            { pattern: /(\d+\.?\d*)\s*over\s*(\d+\.?\d*)/i, op: '/' },
            // Modulo
            { pattern: /(\d+\.?\d*)\s*mod(?:ulo)?\s*(\d+\.?\d*)/i, op: '%' },
        ];
        
        for (const { pattern, op } of arithmeticPatterns) {
            const match = processedCommand.match(pattern);
            if (match) {
                const num1 = parseFloat(match[1]);
                const num2 = parseFloat(match[2]);
                
                if (!isNaN(num1) && !isNaN(num2)) {
                    let result;
                    switch (op) {
                        case '+': result = num1 + num2; break;
                        case '-': result = num1 - num2; break;
                        case '*': result = num1 * num2; break;
                        case '/': result = num2 !== 0 ? num1 / num2 : 'Error'; break;
                        case '%': result = num1 % num2; break;
                    }
                    
                    const expr = `${num1} ${op} ${num2}`;
                    this.expression = expr;
                    this.expressionDisplay.textContent = expr;
                    this.setResult(result);
                    this.addToHistory(expr, result);
                    return result;
                }
            }
        }
        
        // Try chain operations: "5 plus 3 minus 2"
        const chainMatch = processedCommand.match(/(\d+\.?\d*)(?:\s*(?:plus|minus|times|divided by)\s*\d+\.?\d*)+/i);
        if (chainMatch) {
            try {
                let expr = chainMatch[0];
                // Convert words to operators
                expr = expr.replace(/\s*plus\s*/gi, '+');
                expr = expr.replace(/\s*minus\s*/gi, '-');
                expr = expr.replace(/\s*times\s*/gi, '*');
                expr = expr.replace(/\s*divided by\s*/gi, '/');
                
                // Safely evaluate
                const result = this.safeEval(expr);
                if (result !== null && !isNaN(result)) {
                    this.expression = expr;
                    this.expressionDisplay.textContent = expr;
                    this.setResult(result);
                    this.addToHistory(expr, result);
                    return result;
                }
            } catch (e) {
                console.error('Chain calculation error:', e);
            }
        }
        
        // Try to extract just a number to input
        const numberMatch = processedCommand.match(/^\s*(\d+\.?\d*)\s*$/);
        if (numberMatch) {
            this.appendNumber(numberMatch[1]);
            this.showToast(`Entered: ${numberMatch[1]}`, 'info');
            return null;
        }
        
        // Last resort: try to find any two numbers
        const allNumbers = processedCommand.match(/\d+\.?\d*/g);
        if (allNumbers && allNumbers.length >= 2) {
            // Check for operator keyword
            let op = '+';
            if (processedCommand.includes('minus') || processedCommand.includes('subtract')) op = '-';
            else if (processedCommand.includes('times') || processedCommand.includes('multipl')) op = '*';
            else if (processedCommand.includes('divid') || processedCommand.includes('over')) op = '/';
            
            const num1 = parseFloat(allNumbers[0]);
            const num2 = parseFloat(allNumbers[1]);
            
            let result;
            switch (op) {
                case '+': result = num1 + num2; break;
                case '-': result = num1 - num2; break;
                case '*': result = num1 * num2; break;
                case '/': result = num2 !== 0 ? num1 / num2 : 'Error'; break;
            }
            
            const expr = `${num1} ${op} ${num2}`;
            this.expression = expr;
            this.expressionDisplay.textContent = expr;
            this.setResult(result);
            this.addToHistory(expr, result);
            return result;
        }
        
        this.showToast('Could not understand. Try: "5 plus 3" or "square root of 16"', 'info');
        return null;
    }
    
    // Safe evaluation for expressions
    safeEval(expr) {
        try {
            // Only allow numbers and basic operators
            if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
                return null;
            }
            // Use Function constructor for safer eval
            return new Function('return ' + expr)();
        } catch (e) {
            return null;
        }
    }
    
    // Text-to-Speech
    speak(text) {
        if (this.synthesis) {
            this.synthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            this.synthesis.speak(utterance);
        }
    }
    
    // Event Listeners
    initEventListeners() {
        // Voice button
        this.voiceBtn.addEventListener('click', () => {
            if (this.isListening) {
                this.recognition.stop();
            } else {
                this.startListening();
            }
        });
        
        // Number and operator buttons
        document.querySelectorAll('.btn.number').forEach(btn => {
            btn.addEventListener('click', () => this.appendNumber(btn.dataset.value));
        });
        
        document.querySelectorAll('.btn.operator').forEach(btn => {
            btn.addEventListener('click', () => this.setOperation(btn.dataset.action));
        });
        
        document.querySelectorAll('.btn.function').forEach(btn => {
            btn.addEventListener('click', () => this.handleFunction(btn.dataset.action));
        });
        
        document.querySelectorAll('.btn.equals').forEach(btn => {
            btn.addEventListener('click', () => this.calculate());
        });
        
        document.querySelectorAll('.btn.scientific').forEach(btn => {
            btn.addEventListener('click', () => this.handleScientific(btn.dataset.action));
        });
        
        document.querySelectorAll('.btn.programmer').forEach(btn => {
            btn.addEventListener('click', () => this.handleProgrammer(btn.dataset.action));
        });
        
        document.querySelectorAll('.btn.hex-btn').forEach(btn => {
            btn.addEventListener('click', () => this.appendHexDigit(btn.dataset.value));
        });
        
        // Mode switching
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
        });
        
        // Base switching (programmer mode)
        document.querySelectorAll('.base-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchBase(parseInt(btn.dataset.base)));
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // History toggle
        document.getElementById('historyToggle').addEventListener('click', () => this.toggleHistory());
        
        // Clear history
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
        
        // Help panel
        document.getElementById('helpBtn').addEventListener('click', () => this.toggleHelp());
        document.getElementById('closeHelp').addEventListener('click', () => this.toggleHelp());
        
        // User/Auth button
        document.getElementById('userBtn').addEventListener('click', () => {
            if (this.user) {
                this.openModal('profileModal');
                this.fetchUserProfile();
            } else {
                this.openModal('authModal');
            }
        });
        
        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => {
            document.getElementById('shareExpression').textContent = this.expression || this.currentValue;
            document.getElementById('shareResult').textContent = `= ${this.currentValue}`;
            document.getElementById('shareLinkContainer').classList.add('hidden');
            this.openModal('shareModal');
        });
        
        // Keyboard support
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Converter
        document.getElementById('converterType').addEventListener('change', () => this.updateConverterUnits());
        document.getElementById('fromValue').addEventListener('input', () => this.convert());
        document.getElementById('fromUnit').addEventListener('change', () => this.convert());
        document.getElementById('toUnit').addEventListener('change', () => this.convert());
    }
    
    // Initialize Modals
    initModals() {
        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const isLogin = tab.dataset.tab === 'login';
                document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
                document.getElementById('registerForm').classList.toggle('hidden', isLogin);
                document.getElementById('authModalTitle').innerHTML = isLogin 
                    ? '<i class="fas fa-user-circle"></i> Login' 
                    : '<i class="fas fa-user-plus"></i> Register';
            });
        });
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            this.login(email, password);
        });
        
        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const displayName = document.getElementById('registerDisplayName').value;
            this.register(username, email, password, displayName);
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // View saved calculations
        document.getElementById('viewSavedBtn').addEventListener('click', () => {
            this.closeModal('profileModal');
            this.loadSavedCalculations();
            this.openModal('savedListModal');
        });
        
        // View formulas
        document.getElementById('viewFormulasBtn').addEventListener('click', () => {
            this.closeModal('profileModal');
            this.loadFormulas(false);
            this.openModal('formulasListModal');
        });
        
        // Save form
        document.getElementById('saveForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('saveName').value;
            const category = document.getElementById('saveCategory').value;
            const description = document.getElementById('saveDescription').value;
            this.saveToFavorites(name, category, description);
        });
        
        // Share link generation
        document.getElementById('generateShareLink').addEventListener('click', () => this.shareCalculation());
        
        // Copy share link
        document.getElementById('copyShareLink').addEventListener('click', () => {
            const linkInput = document.getElementById('shareLink');
            linkInput.select();
            document.execCommand('copy');
            this.showToast('Link copied to clipboard!', 'success');
        });
        
        // Formula tabs
        document.querySelectorAll('.formula-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.formula-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const isMyFormulas = tab.dataset.tab === 'my-formulas';
                document.getElementById('myFormulasList').classList.toggle('hidden', !isMyFormulas);
                document.getElementById('publicFormulasList').classList.toggle('hidden', isMyFormulas);
                
                if (!isMyFormulas) {
                    this.loadFormulas(true);
                }
            });
        });
        
        // Create formula button
        document.getElementById('createFormulaBtn').addEventListener('click', () => {
            this.closeModal('formulasListModal');
            this.openModal('formulaModal');
        });
        
        // Add variable button
        document.getElementById('addVariableBtn').addEventListener('click', () => {
            const container = document.getElementById('formulaVariables');
            const newVar = document.createElement('div');
            newVar.className = 'variable-input';
            newVar.innerHTML = `
                <input type="text" placeholder="Variable name (e.g., r)" class="var-name">
                <input type="text" placeholder="Description" class="var-desc">
                <button type="button" class="remove-var-btn"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(newVar);
            
            newVar.querySelector('.remove-var-btn').addEventListener('click', () => newVar.remove());
        });
        
        // Remove variable buttons
        document.querySelectorAll('.remove-var-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.variable-input').remove());
        });
        
        // Formula form
        document.getElementById('formulaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const variables = [];
            document.querySelectorAll('.variable-input').forEach(varInput => {
                const name = varInput.querySelector('.var-name').value;
                const desc = varInput.querySelector('.var-desc').value;
                if (name) {
                    variables.push({ name, description: desc });
                }
            });
            
            const formulaData = {
                name: document.getElementById('formulaName').value,
                formula: document.getElementById('formulaExpression').value,
                variables,
                description: document.getElementById('formulaDescription').value,
                category: document.getElementById('formulaCategory').value,
                isPublic: document.getElementById('formulaPublic').checked
            };
            
            this.saveFormula(formulaData);
        });
    }
    
    openModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }
    
    renderSavedList(savedItems) {
        const container = document.getElementById('savedList');
        
        if (!savedItems || savedItems.length === 0) {
            container.innerHTML = '<p class="no-items">No saved calculations yet</p>';
            return;
        }
        
        container.innerHTML = savedItems.map(item => `
            <div class="saved-item" data-id="${item.id}">
                <div class="saved-item-header">
                    <span class="saved-item-name">${item.name}</span>
                    ${item.category ? `<span class="formula-item-category">${item.category}</span>` : ''}
                </div>
                <div class="formula-item-expression">${item.expression} = ${item.result}</div>
                ${item.description ? `<div class="saved-item-description">${item.description}</div>` : ''}
                <div class="saved-item-actions">
                    <button class="saved-action-btn use-btn" data-result="${item.result}">
                        <i class="fas fa-calculator"></i> Use
                    </button>
                    <button class="saved-action-btn delete" data-id="${item.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.use-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentValue = btn.dataset.result;
                this.updateDisplay();
                this.closeModal('savedListModal');
            });
        });
        
        container.querySelectorAll('.saved-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => this.deleteSaved(btn.dataset.id));
        });
    }
    
    renderFormulasList(formulas, containerId) {
        const container = document.getElementById(containerId);
        
        if (!formulas || formulas.length === 0) {
            container.innerHTML = '<p class="no-items">No formulas available</p>';
            return;
        }
        
        container.innerHTML = formulas.map(formula => `
            <div class="formula-item" data-id="${formula.id}">
                <div class="formula-item-header">
                    <span class="formula-item-name">${formula.name}</span>
                    <span class="formula-item-category">${formula.category || 'other'}</span>
                </div>
                <div class="formula-item-expression">${formula.formula}</div>
                ${formula.description ? `<div class="formula-item-description">${formula.description}</div>` : ''}
                <div class="formula-item-actions">
                    <button class="formula-action-btn use-formula" data-formula="${formula.formula}">
                        <i class="fas fa-play"></i> Use
                    </button>
                    ${containerId === 'myFormulasList' ? `
                        <button class="formula-action-btn delete" data-id="${formula.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.use-formula').forEach(btn => {
            btn.addEventListener('click', () => {
                this.useFormula(btn.dataset.formula);
                this.closeModal('formulasListModal');
            });
        });
        
        container.querySelectorAll('.formula-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => this.deleteFormula(btn.dataset.id));
        });
    }
    
    useFormula(formula) {
        // For now, just show the formula - in a full implementation, 
        // you'd prompt for variable values
        this.expression = formula;
        this.expressionDisplay.textContent = formula;
        this.showToast('Formula loaded. Enter values for variables.', 'info');
    }
    
    // Calculator Operations
    appendNumber(value) {
        if (this.shouldResetDisplay) {
            this.currentValue = '';
            this.shouldResetDisplay = false;
        }
        
        if (value === '.' && this.currentValue.includes('.')) return;
        if (this.currentValue === '0' && value !== '.') {
            this.currentValue = value;
        } else {
            this.currentValue += value;
        }
        
        this.updateDisplay();
    }
    
    appendHexDigit(value) {
        if (this.currentBase !== 16) return;
        
        if (this.shouldResetDisplay) {
            this.currentValue = '';
            this.shouldResetDisplay = false;
        }
        
        if (this.currentValue === '0') {
            this.currentValue = value;
        } else {
            this.currentValue += value;
        }
        
        this.updateDisplay();
        this.updateBaseDisplay();
    }
    
    setOperation(op) {
        if (this.operation !== null && !this.shouldResetDisplay) {
            this.calculate();
        }
        
        const opSymbols = {
            'add': '+',
            'subtract': '-',
            'multiply': '×',
            'divide': '÷'
        };
        
        this.operation = op;
        this.previousValue = this.currentValue;
        this.expression = `${this.currentValue} ${opSymbols[op] || op}`;
        this.expressionDisplay.textContent = this.expression;
        this.shouldResetDisplay = true;
    }
    
    calculate() {
        if (this.operation === null || this.shouldResetDisplay) return;
        
        const prev = parseFloat(this.previousValue);
        const current = parseFloat(this.currentValue);
        let result;
        
        switch (this.operation) {
            case 'add':
                result = prev + current;
                break;
            case 'subtract':
                result = prev - current;
                break;
            case 'multiply':
                result = prev * current;
                break;
            case 'divide':
                result = current !== 0 ? prev / current : 'Error';
                break;
        }
        
        const fullExpression = `${this.expression} ${this.currentValue} =`;
        this.expressionDisplay.textContent = fullExpression;
        this.setResult(result);
        this.addToHistory(fullExpression.replace(' =', ''), result);
        
        this.operation = null;
        this.previousValue = '';
        this.shouldResetDisplay = true;
        
        // Speak the result
        if (typeof result === 'number') {
            this.speak(`equals ${this.formatNumber(result)}`);
        }
    }
    
    handleFunction(action) {
        switch (action) {
            case 'clear':
                this.clear();
                break;
            case 'clearEntry':
                this.currentValue = '0';
                this.updateDisplay();
                break;
            case 'backspace':
                this.backspace();
                break;
            case 'negate':
                this.currentValue = (parseFloat(this.currentValue) * -1).toString();
                this.updateDisplay();
                break;
        }
    }
    
    handleScientific(action) {
        const num = parseFloat(this.currentValue);
        let result;
        
        switch (action) {
            case 'sin':
                result = Math.sin(num * Math.PI / 180);
                break;
            case 'cos':
                result = Math.cos(num * Math.PI / 180);
                break;
            case 'tan':
                result = Math.tan(num * Math.PI / 180);
                break;
            case 'asin':
                result = Math.asin(num) * 180 / Math.PI;
                break;
            case 'acos':
                result = Math.acos(num) * 180 / Math.PI;
                break;
            case 'atan':
                result = Math.atan(num) * 180 / Math.PI;
                break;
            case 'log':
                result = Math.log10(num);
                break;
            case 'ln':
                result = Math.log(num);
                break;
            case 'exp':
                result = Math.exp(num);
                break;
            case 'tenPow':
                result = Math.pow(10, num);
                break;
            case 'sqrt':
                result = Math.sqrt(num);
                break;
            case 'cbrt':
                result = Math.cbrt(num);
                break;
            case 'square':
                result = Math.pow(num, 2);
                break;
            case 'cube':
                result = Math.pow(num, 3);
                break;
            case 'power':
                this.setOperation('power');
                return;
            case 'factorial':
                result = this.factorial(num);
                break;
            case 'pi':
                result = Math.PI;
                break;
            case 'e':
                result = Math.E;
                break;
            case 'abs':
                result = Math.abs(num);
                break;
            case 'inverse':
                result = num !== 0 ? 1 / num : 'Error';
                break;
            case 'percent':
                result = num / 100;
                break;
            case 'mod':
                this.setOperation('mod');
                return;
            case 'random':
                result = Math.random();
                break;
            case 'parenthesisOpen':
                this.expression += '(';
                this.expressionDisplay.textContent = this.expression;
                return;
            case 'parenthesisClose':
                this.expression += this.currentValue + ')';
                this.expressionDisplay.textContent = this.expression;
                return;
        }
        
        if (result !== undefined) {
            this.setResult(result);
            this.addToHistory(`${action}(${num})`, result);
        }
    }
    
    handleProgrammer(action) {
        const num = parseInt(this.currentValue, this.currentBase);
        let result;
        
        switch (action) {
            case 'and':
            case 'or':
            case 'xor':
                this.setOperation(action);
                return;
            case 'not':
                result = ~num >>> 0;
                break;
            case 'leftShift':
                this.setOperation('leftShift');
                return;
            case 'rightShift':
                this.setOperation('rightShift');
                return;
        }
        
        if (result !== undefined) {
            this.currentValue = result.toString(this.currentBase).toUpperCase();
            this.updateDisplay();
            this.updateBaseDisplay();
        }
    }
    
    factorial(n) {
        if (n < 0) return 'Error';
        if (n === 0 || n === 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
    
    clear() {
        this.currentValue = '0';
        this.previousValue = '';
        this.operation = null;
        this.expression = '';
        this.shouldResetDisplay = false;
        this.expressionDisplay.textContent = '';
        this.updateDisplay();
        
        if (this.currentMode === 'programmer') {
            this.updateBaseDisplay();
        }
    }
    
    backspace() {
        if (this.currentValue.length > 1) {
            this.currentValue = this.currentValue.slice(0, -1);
        } else {
            this.currentValue = '0';
        }
        this.updateDisplay();
        
        if (this.currentMode === 'programmer') {
            this.updateBaseDisplay();
        }
    }
    
    setResult(result) {
        if (typeof result === 'number') {
            this.currentValue = this.formatNumber(result);
        } else {
            this.currentValue = result.toString();
        }
        this.updateDisplay();
        
        if (this.currentMode === 'programmer') {
            this.updateBaseDisplay();
        }
    }
    
    formatNumber(num) {
        if (Number.isInteger(num)) {
            return num.toString();
        }
        return parseFloat(num.toPrecision(12)).toString();
    }
    
    updateDisplay() {
        this.resultDisplay.textContent = this.currentValue;
    }
    
    // Mode Switching
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Show/hide mode panels
        document.getElementById('basicMode').classList.toggle('hidden', mode !== 'basic');
        document.getElementById('scientificMode').classList.toggle('hidden', mode !== 'scientific');
        document.getElementById('programmerMode').classList.toggle('hidden', mode !== 'programmer');
        document.getElementById('converterMode').classList.toggle('hidden', mode !== 'converter');
        
        // Reset calculator state
        if (mode === 'programmer') {
            this.currentBase = 10;
            this.updateBaseDisplay();
        }
        
        if (mode === 'converter') {
            this.updateConverterUnits();
        }
    }
    
    // Programmer Mode
    switchBase(base) {
        const currentNum = parseInt(this.currentValue, this.currentBase);
        this.currentBase = base;
        this.currentValue = currentNum.toString(base).toUpperCase();
        
        // Update base buttons
        document.querySelectorAll('.base-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.base) === base);
        });
        
        // Enable/disable hex buttons
        const hexBtns = document.querySelectorAll('.hex-btn');
        hexBtns.forEach(btn => {
            btn.disabled = base !== 16;
            btn.style.opacity = base === 16 ? '1' : '0.5';
        });
        
        // Enable/disable number buttons based on base
        document.querySelectorAll('#programmerMode .btn.number').forEach(btn => {
            const val = parseInt(btn.dataset.value);
            btn.disabled = val >= base;
            btn.style.opacity = val < base ? '1' : '0.5';
        });
        
        this.updateDisplay();
        this.updateBaseDisplay();
    }
    
    updateBaseDisplay() {
        const num = parseInt(this.currentValue, this.currentBase) || 0;
        
        document.getElementById('hexValue').textContent = num.toString(16).toUpperCase();
        document.getElementById('decValue').textContent = num.toString(10);
        document.getElementById('octValue').textContent = num.toString(8);
        document.getElementById('binValue').textContent = num.toString(2);
    }
    
    // Unit Converter
    initConverter() {
        this.converterUnits = {
            length: {
                units: ['meter', 'kilometer', 'centimeter', 'millimeter', 'mile', 'yard', 'foot', 'inch'],
                base: 'meter',
                conversions: {
                    meter: 1,
                    kilometer: 1000,
                    centimeter: 0.01,
                    millimeter: 0.001,
                    mile: 1609.344,
                    yard: 0.9144,
                    foot: 0.3048,
                    inch: 0.0254
                }
            },
            weight: {
                units: ['kilogram', 'gram', 'milligram', 'pound', 'ounce', 'ton'],
                base: 'kilogram',
                conversions: {
                    kilogram: 1,
                    gram: 0.001,
                    milligram: 0.000001,
                    pound: 0.453592,
                    ounce: 0.0283495,
                    ton: 1000
                }
            },
            temperature: {
                units: ['celsius', 'fahrenheit', 'kelvin'],
                base: 'celsius',
                special: true
            },
            area: {
                units: ['square meter', 'square kilometer', 'square foot', 'square mile', 'acre', 'hectare'],
                base: 'square meter',
                conversions: {
                    'square meter': 1,
                    'square kilometer': 1000000,
                    'square foot': 0.092903,
                    'square mile': 2589988.11,
                    'acre': 4046.86,
                    'hectare': 10000
                }
            },
            volume: {
                units: ['liter', 'milliliter', 'gallon', 'quart', 'pint', 'cup', 'cubic meter'],
                base: 'liter',
                conversions: {
                    liter: 1,
                    milliliter: 0.001,
                    gallon: 3.78541,
                    quart: 0.946353,
                    pint: 0.473176,
                    cup: 0.236588,
                    'cubic meter': 1000
                }
            },
            speed: {
                units: ['meter per second', 'kilometer per hour', 'mile per hour', 'knot'],
                base: 'meter per second',
                conversions: {
                    'meter per second': 1,
                    'kilometer per hour': 0.277778,
                    'mile per hour': 0.44704,
                    'knot': 0.514444
                }
            },
            time: {
                units: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'],
                base: 'second',
                conversions: {
                    second: 1,
                    minute: 60,
                    hour: 3600,
                    day: 86400,
                    week: 604800,
                    month: 2592000,
                    year: 31536000
                }
            },
            data: {
                units: ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'],
                base: 'byte',
                conversions: {
                    byte: 1,
                    kilobyte: 1024,
                    megabyte: 1048576,
                    gigabyte: 1073741824,
                    terabyte: 1099511627776
                }
            }
        };
        
        this.updateConverterUnits();
    }
    
    updateConverterUnits() {
        const type = document.getElementById('converterType').value;
        const units = this.converterUnits[type].units;
        
        const fromSelect = document.getElementById('fromUnit');
        const toSelect = document.getElementById('toUnit');
        
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';
        
        units.forEach((unit, index) => {
            fromSelect.innerHTML += `<option value="${unit}" ${index === 0 ? 'selected' : ''}>${unit}</option>`;
            toSelect.innerHTML += `<option value="${unit}" ${index === 1 ? 'selected' : ''}>${unit}</option>`;
        });
        
        this.convert();
    }
    
    convert() {
        const type = document.getElementById('converterType').value;
        const fromValue = parseFloat(document.getElementById('fromValue').value) || 0;
        const fromUnit = document.getElementById('fromUnit').value;
        const toUnit = document.getElementById('toUnit').value;
        
        let result;
        
        if (type === 'temperature') {
            result = this.convertTemperature(fromValue, fromUnit, toUnit);
        } else {
            const conversions = this.converterUnits[type].conversions;
            const baseValue = fromValue * conversions[fromUnit];
            result = baseValue / conversions[toUnit];
        }
        
        document.getElementById('toValue').value = this.formatNumber(result);
    }
    
    convertTemperature(value, from, to) {
        let celsius;
        
        // Convert to Celsius first
        switch (from) {
            case 'celsius':
                celsius = value;
                break;
            case 'fahrenheit':
                celsius = (value - 32) * 5 / 9;
                break;
            case 'kelvin':
                celsius = value - 273.15;
                break;
        }
        
        // Convert from Celsius to target
        switch (to) {
            case 'celsius':
                return celsius;
            case 'fahrenheit':
                return celsius * 9 / 5 + 32;
            case 'kelvin':
                return celsius + 273.15;
        }
    }
    
    // History Management
    addToHistory(expression, result) {
        const item = {
            expression,
            result: this.formatNumber(result),
            timestamp: new Date().toLocaleTimeString()
        };
        
        this.history.unshift(item);
        if (this.history.length > 50) {
            this.history.pop();
        }
        
        this.saveHistory();
        this.renderHistory();
        
        // Sync with server if logged in
        this.saveCalculationToServer(expression, result, this.currentMode);
    }
    
    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="no-history">No calculations yet</p>';
            return;
        }
        
        this.historyList.innerHTML = this.history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-expression">${item.expression}</div>
                <div class="history-result">= ${item.result}</div>
                <div class="history-time">${item.timestamp}</div>
            </div>
        `).join('');
        
        // Add click handlers to history items
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.currentValue = this.history[index].result;
                this.updateDisplay();
            });
        });
    }
    
    saveHistory() {
        localStorage.setItem('calculatorHistory', JSON.stringify(this.history));
    }
    
    loadHistory() {
        const saved = localStorage.getItem('calculatorHistory');
        if (saved) {
            this.history = JSON.parse(saved);
            this.renderHistory();
        }
    }
    
    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
        this.showToast('History cleared', 'success');
    }
    
    toggleHistory() {
        this.historyPanel.classList.toggle('show');
    }
    
    // Theme Management
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('calculatorTheme', newTheme);
        
        const icon = document.querySelector('#themeToggle i');
        icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    loadTheme() {
        const saved = localStorage.getItem('calculatorTheme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
            const icon = document.querySelector('#themeToggle i');
            icon.className = saved === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    // Help Panel
    toggleHelp() {
        this.voiceHelp.classList.toggle('show');
    }
    
    showVoiceHelp() {
        // Show help with voice command examples
        const helpExamples = [
            '📢 Voice Command Examples:',
            '',
            '🔢 Basic Math:',
            '• "five plus three"',
            '• "10 minus 4"',
            '• "6 times 7"',
            '• "20 divided by 5"',
            '',
            '🔬 Scientific:',
            '• "square root of 16"',
            '• "5 squared"',
            '• "sine of 45"',
            '• "10 percent of 50"',
            '',
            '⚙️ Commands:',
            '• "clear" - reset calculator',
            '• "history" - show history',
            '• "scientific mode"',
            '• "help" - show this'
        ];
        
        this.showToast(helpExamples.slice(0, 5).join('\n'), 'info', 5000);
        this.voiceHelp.classList.add('show');
    }
    
    // Keyboard Support
    handleKeyboard(e) {
        // Prevent default for calculator keys
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            this.appendNumber(e.key);
        } else if (e.key === '.') {
            e.preventDefault();
            this.appendNumber('.');
        } else if (e.key === '+') {
            e.preventDefault();
            this.setOperation('add');
        } else if (e.key === '-') {
            e.preventDefault();
            this.setOperation('subtract');
        } else if (e.key === '*') {
            e.preventDefault();
            this.setOperation('multiply');
        } else if (e.key === '/') {
            e.preventDefault();
            this.setOperation('divide');
        } else if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            this.calculate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.clear();
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            this.backspace();
        }
    }
    
    // Toast Notifications
    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove toast after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize the calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new VoiceCalculator();
});
