const axios = require('axios');
const readlineSync = require('readline-sync');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');

class BubblesAutoRegister {
    constructor() {
        this.baseUrl = 'https://bubbles-ogcp.onrender.com';
        this.referralCode = 'VuoKGo0K';
    }

    // Generate a random Ethereum-like wallet address
    generateWalletAddress() {
        return '0x' + crypto.randomBytes(20).toString('hex');
    }

    // Write wallet to file
    saveWalletToFile(wallet) {
        fs.appendFileSync('wallet-generated.txt', wallet + '\n', 'utf8');
    }

    // Register a new user
    async registerUser() {
        const wallet = this.generateWalletAddress();

        try {
            const response = await axios.post(`${this.baseUrl}/user`, {
                wallet: wallet,
                invite: this.referralCode
            }, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://popyourbubbles.fun',
                    'Referer': 'https://popyourbubbles.fun/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
                }
            });

            console.log(`Registration successful for wallet: ${wallet}`);
            console.log('Response:', response.data);

            // Save wallet to file
            this.saveWalletToFile(wallet);

            return response.data;
        } catch (error) {
            console.error('Registration failed:', error.response ? error.response.data : error.message);
            return null;
        }
    }

    // Main registration process
    async startRegistration() {
        // Get user input
        const referralCode = readlineSync.question('Enter the referral code (press enter to use default): ') || this.referralCode;
        const accountCount = parseInt(readlineSync.question('Enter number of accounts to create: '));

        this.referralCode = referralCode;

        // Register multiple accounts
        for (let i = 0; i < accountCount; i++) {
            console.log(`\nRegistering account ${i + 1} of ${accountCount}`);
            await this.registerUser();
            
            // Optional: Add a delay between registrations to avoid rate limiting
            await this.delay(1000);
        }
    }

    // Delay function to prevent rapid requests
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    console.log('Pop Your Bubbles Auto-Register Bot - AirdropInsiders');
    const bot = new BubblesAutoRegister();
    
    try {
        await bot.startRegistration();
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();