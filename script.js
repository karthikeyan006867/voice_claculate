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
        
        // Clear commands
        if (command.includes('clear') || command.includes('reset')) {
            this.clear();
            this.speak('Cleared');
            return;
        }
        
        // History commands
        if (command.includes('history') || command.includes('show history')) {
            this.toggleHistory();
            this.speak('Showing history');
            return;
        }
        
        // Undo command
        if (command.includes('undo') || command.includes('back')) {
            this.backspace();
            this.speak('Undone');
            return;
        }
        
        // Equals command
        if (command.includes('equals') || command.includes('calculate') || command.includes('result')) {
            this.calculate();
            return;
        }
        
        // Mode switching
        if (command.includes('basic mode')) {
            this.switchMode('basic');
            this.speak('Switched to basic mode');
            return;
        }
        if (command.includes('scientific mode')) {
            this.switchMode('scientific');
            this.speak('Switched to scientific mode');
            return;
        }
        if (command.includes('programmer mode')) {
            this.switchMode('programmer');
            this.speak('Switched to programmer mode');
            return;
        }
        if (command.includes('converter') || command.includes('convert')) {
            this.switchMode('converter');
            this.speak('Switched to converter mode');
            return;
        }
        
        // Parse mathematical expressions
        const result = this.parseVoiceExpression(command);
        if (result !== null) {
            this.speak(`The answer is ${result}`);
        }
    }
    
    parseVoiceExpression(command) {
        // Number words to digits mapping
        const numberWords = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
            'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
            'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
            'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
            'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
            'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000',
            'million': '1000000'
        };
        
        // Replace number words with digits
        let processedCommand = command;
        for (const [word, digit] of Object.entries(numberWords)) {
            processedCommand = processedCommand.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
        }
        
        // Scientific functions
        const scientificPatterns = [
            { pattern: /square root of (\d+\.?\d*)/i, fn: (m) => Math.sqrt(parseFloat(m[1])) },
            { pattern: /sqrt (\d+\.?\d*)/i, fn: (m) => Math.sqrt(parseFloat(m[1])) },
            { pattern: /cube root of (\d+\.?\d*)/i, fn: (m) => Math.cbrt(parseFloat(m[1])) },
            { pattern: /(\d+\.?\d*) squared/i, fn: (m) => Math.pow(parseFloat(m[1]), 2) },
            { pattern: /square of (\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), 2) },
            { pattern: /(\d+\.?\d*) cubed/i, fn: (m) => Math.pow(parseFloat(m[1]), 3) },
            { pattern: /cube of (\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), 3) },
            { pattern: /(\d+\.?\d*) to the power of (\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), parseFloat(m[2])) },
            { pattern: /(\d+\.?\d*) power (\d+\.?\d*)/i, fn: (m) => Math.pow(parseFloat(m[1]), parseFloat(m[2])) },
            { pattern: /sine? of (\d+\.?\d*)/i, fn: (m) => Math.sin(parseFloat(m[1]) * Math.PI / 180) },
            { pattern: /cosine? of (\d+\.?\d*)/i, fn: (m) => Math.cos(parseFloat(m[1]) * Math.PI / 180) },
            { pattern: /tan(?:gent)? of (\d+\.?\d*)/i, fn: (m) => Math.tan(parseFloat(m[1]) * Math.PI / 180) },
            { pattern: /log(?:arithm)? of (\d+\.?\d*)/i, fn: (m) => Math.log10(parseFloat(m[1])) },
            { pattern: /natural log of (\d+\.?\d*)/i, fn: (m) => Math.log(parseFloat(m[1])) },
            { pattern: /ln of (\d+\.?\d*)/i, fn: (m) => Math.log(parseFloat(m[1])) },
            { pattern: /(\d+\.?\d*) factorial/i, fn: (m) => this.factorial(parseInt(m[1])) },
            { pattern: /factorial of (\d+\.?\d*)/i, fn: (m) => this.factorial(parseInt(m[1])) },
            { pattern: /absolute value of (-?\d+\.?\d*)/i, fn: (m) => Math.abs(parseFloat(m[1])) },
            { pattern: /percentage of (\d+\.?\d*) of (\d+\.?\d*)/i, fn: (m) => (parseFloat(m[1]) / 100) * parseFloat(m[2]) },
            { pattern: /(\d+\.?\d*) percent of (\d+\.?\d*)/i, fn: (m) => (parseFloat(m[1]) / 100) * parseFloat(m[2]) },
        ];
        
        for (const { pattern, fn } of scientificPatterns) {
            const match = processedCommand.match(pattern);
            if (match) {
                try {
                    const result = fn(match);
                    this.setResult(result);
                    this.addToHistory(`${command}`, result);
                    return result;
                } catch (e) {
                    console.error('Scientific calculation error:', e);
                }
            }
        }
        
        // Basic arithmetic patterns
        const arithmeticPatterns = [
            { pattern: /(\d+\.?\d*)\s*(?:plus|\+|add(?:ed)?(?:\s+to)?)\s*(\d+\.?\d*)/i, op: '+' },
            { pattern: /add\s+(\d+\.?\d*)\s+(?:and|to)\s+(\d+\.?\d*)/i, op: '+' },
            { pattern: /(\d+\.?\d*)\s*(?:minus|-|subtract(?:ed)?(?:\s+from)?)\s*(\d+\.?\d*)/i, op: '-' },
            { pattern: /subtract\s+(\d+\.?\d*)\s+from\s+(\d+\.?\d*)/i, op: '-', reverse: true },
            { pattern: /(\d+\.?\d*)\s*(?:times|×|x|multiplied by|multiply(?:\s+by)?)\s*(\d+\.?\d*)/i, op: '*' },
            { pattern: /multiply\s+(\d+\.?\d*)\s+(?:by|and)\s+(\d+\.?\d*)/i, op: '*' },
            { pattern: /(\d+\.?\d*)\s*(?:divided by|÷|\/|over)\s*(\d+\.?\d*)/i, op: '/' },
            { pattern: /divide\s+(\d+\.?\d*)\s+by\s+(\d+\.?\d*)/i, op: '/' },
            { pattern: /(\d+\.?\d*)\s*(?:mod(?:ulo)?|%)\s*(\d+\.?\d*)/i, op: '%' },
        ];
        
        for (const { pattern, op, reverse } of arithmeticPatterns) {
            const match = processedCommand.match(pattern);
            if (match) {
                let num1 = parseFloat(match[1]);
                let num2 = parseFloat(match[2]);
                
                if (reverse) {
                    [num1, num2] = [num2, num1];
                }
                
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
        
        // Try to extract just a number
        const numberMatch = processedCommand.match(/(\d+\.?\d*)/);
        if (numberMatch) {
            const num = parseFloat(numberMatch[1]);
            this.appendNumber(numberMatch[1]);
            return null;
        }
        
        this.showToast('Could not understand command. Try again.', 'info');
        return null;
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
        
        // Keyboard support
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Converter
        document.getElementById('converterType').addEventListener('change', () => this.updateConverterUnits());
        document.getElementById('fromValue').addEventListener('input', () => this.convert());
        document.getElementById('fromUnit').addEventListener('change', () => this.convert());
        document.getElementById('toUnit').addEventListener('change', () => this.convert());
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
