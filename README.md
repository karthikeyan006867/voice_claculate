# 🎤 Advanced Voice-Controlled Calculator

A modern, feature-rich calculator with voice control, multiple calculation modes, cloud sync, and a beautiful responsive UI.

![Voice Calculator](https://img.shields.io/badge/Voice-Enabled-green)
![Modes](https://img.shields.io/badge/Modes-4-blue)
![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Responsive](https://img.shields.io/badge/Responsive-Yes-purple)

## ✨ Features

### 🎙️ Voice Control
- **Natural Language Processing**: Speak calculations in plain English
- **Speech Recognition**: Real-time voice input with visual feedback
- **Text-to-Speech**: Hear your results spoken back to you
- **Voice Command Analytics**: Track your voice usage patterns
- **Supports complex expressions**: "What is 25 plus 17", "Square root of 144"

### 🧮 Calculator Modes

#### Basic Mode
- Standard arithmetic operations (+, -, ×, ÷)
- Percentage calculations
- Negation and decimal support

#### Scientific Mode
- Trigonometric functions (sin, cos, tan, and inverses)
- Logarithmic functions (log, ln)
- Exponential and power functions
- Square root, cube root
- Factorial calculations
- Constants (π, e)
- Parentheses support

#### Programmer Mode
- Multiple base support (Binary, Octal, Decimal, Hexadecimal)
- Bitwise operations (AND, OR, XOR, NOT)
- Bit shifting (Left shift, Right shift)
- Real-time base conversion display

#### Unit Converter
- **Length**: meter, kilometer, mile, foot, inch, etc.
- **Weight**: kilogram, pound, ounce, gram, ton
- **Temperature**: Celsius, Fahrenheit, Kelvin
- **Area**: square meter, acre, hectare
- **Volume**: liter, gallon, cup, pint
- **Speed**: m/s, km/h, mph, knots
- **Time**: seconds to years
- **Data Storage**: bytes to terabytes

### 🗄️ Cloud Features (with PostgreSQL/Neon)
- **User Authentication**: Register and login securely
- **Cloud Sync**: Sync calculation history across devices
- **Saved Calculations**: Save favorite calculations with names and categories
- **Custom Formulas**: Create and save reusable formulas
- **Public Formula Library**: Share and discover formulas from other users
- **Share Calculations**: Generate shareable links for calculations
- **User Statistics**: Track total calculations, conversions, voice commands
- **Streak Tracking**: Keep track of your daily usage streaks

### 🎨 Additional Features
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **Calculation History**: View and reuse past calculations
- **Keyboard Support**: Full keyboard navigation
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Glass Morphism UI**: Modern, sleek design with blur effects
- **Animations**: Smooth transitions and hover effects

## 🗣️ Voice Commands

### Basic Operations
| Command | Example |
|---------|---------|
| Addition | "5 plus 3", "add 10 and 20" |
| Subtraction | "10 minus 4", "subtract 5 from 15" |
| Multiplication | "6 times 7", "multiply 8 by 9" |
| Division | "20 divided by 4", "divide 100 by 5" |

### Scientific Functions
| Command | Example |
|---------|---------|
| Square Root | "square root of 16" |
| Powers | "2 to the power of 8" |
| Trigonometry | "sine of 30 degrees" |
| Logarithm | "log of 100" |
| Factorial | "5 factorial" |
| Percentage | "25 percent of 200" |

### Control Commands
| Command | Action |
|---------|--------|
| "clear" / "reset" | Clear the display |
| "equals" / "calculate" | Get the result |
| "undo" / "back" | Backspace |
| "history" | Show calculation history |
| "basic mode" | Switch to basic calculator |
| "scientific mode" | Switch to scientific calculator |
| "programmer mode" | Switch to programmer calculator |
| "converter" | Switch to unit converter |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Modern web browser with Web Speech API support (Chrome, Edge, Safari)
- Microphone access for voice features
- PostgreSQL database (Neon recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/karthikeyan006867/voice_claculate.git
cd voice_claculate
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with your database credentials:
```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=your-secret-key
PORT=3000
```

4. Start the server:
```bash
npm start
```

5. Open http://localhost:3000 in your browser

6. Allow microphone access when prompted

## 🎯 Usage

1. **Click the microphone button** to start voice input
2. **Speak your calculation** clearly
3. **Wait for the result** to appear and be spoken

Or use the **on-screen buttons** and **keyboard** for manual input.

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 0-9 | Enter numbers |
| . | Decimal point |
| + | Addition |
| - | Subtraction |
| * | Multiplication |
| / | Division |
| Enter / = | Calculate |
| Escape | Clear |
| Backspace | Delete last digit |

## 🛠️ Technologies Used

- **HTML5** - Structure
- **CSS3** - Styling with CSS Variables, Flexbox, Grid
- **JavaScript (ES6+)** - Calculator logic and voice processing
- **Node.js & Express** - Backend server
- **PostgreSQL (Neon)** - Cloud database
- **JWT** - Secure authentication
- **Web Speech API** - Voice recognition and synthesis
- **Font Awesome** - Icons
- **Google Fonts** - Orbitron & Roboto typography

## 🗄️ Database Schema

The application uses PostgreSQL with the following tables:
- `users` - User accounts and preferences
- `calculation_history` - Calculation logs
- `saved_calculations` - Favorite/saved calculations
- `custom_formulas` - User-defined formulas
- `conversion_history` - Unit conversion logs
- `user_statistics` - Usage statistics and streaks
- `voice_commands` - Voice command analytics
- `shared_calculations` - Shareable calculation links

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/profile` | Get user profile |
| POST | `/api/calculations` | Save calculation |
| GET | `/api/calculations` | Get calculation history |
| POST | `/api/saved` | Save to favorites |
| GET | `/api/saved` | Get saved calculations |
| POST | `/api/formulas` | Create custom formula |
| GET | `/api/formulas` | Get user's formulas |
| GET | `/api/formulas/public` | Get public formulas |
| POST | `/api/share` | Share a calculation |
| GET | `/api/share/:id` | Get shared calculation |
| GET | `/api/statistics` | Get user statistics |

## 📱 Browser Support

| Browser | Voice Support | Notes |
|---------|--------------|-------|
| Chrome | ✅ Full | Recommended |
| Edge | ✅ Full | Works great |
| Safari | ✅ Full | macOS & iOS |
| Firefox | ⚠️ Limited | No voice input |
| Opera | ✅ Full | Works well |

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👤 Author

**Karthikeyan**
- GitHub: [@karthikeyan006867](https://github.com/karthikeyan006867)

---

⭐ Star this repo if you find it helpful!⭐ Star this repo if you find it helpful!