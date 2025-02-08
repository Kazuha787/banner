const ethers = require('ethers');
const axios = require('axios');
const readline = require('readline');

const DEFAULT_REF_CODE = 'uzja5f4s5yb1';
const API_BASE_URL = 'https://cult-api.ippcoin.com';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// ANSI Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

// Logger
const log = {
    info: (msg) => console.log(`${colors.blue}ℹ ${colors.reset}${msg}`),
    success: (msg) => console.log(`${colors.green}✔ ${colors.reset}${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠ ${colors.reset}${msg}`),
    error: (msg) => console.log(`${colors.red}✖ ${colors.reset}${msg}`),
    verbose: (msg) => process.env.VERBOSE && console.log(`${colors.gray}› ${colors.reset}${msg}`),
    title: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`),
    stats: (msg) => console.log(`${colors.yellow}📊 ${colors.reset}${msg}`)
};

// Spinner
class Spinner {
    constructor(message) {
        this.message = message;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.currentFrame = 0;
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 80);
        return this;
    }

    stop(message) {
        clearInterval(this.interval);
        process.stdout.write('\r' + ' '.repeat(this.message.length + 2) + '\r');
        if (message) console.log(message);
        return this;
    }

    succeed(message) {
        this.stop(`${colors.green}✔${colors.reset} ${message}`);
    }

    fail(message) {
        this.stop(`${colors.red}✖${colors.reset} ${message}`);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function question(query) {
    return new Promise((resolve) => rl.question(`${colors.yellow}?${colors.reset} ${query}`, resolve));
}

async function getTotalWallets() {
    try {
        const response = await axios.get(`${API_BASE_URL}/wallet/get-total-wallet`, {
            headers: {
                'Accept': 'application/json',
                'Origin': 'https://cult.world',
                'Referer': 'https://cult.world/'
            }
        });
        return response.data.data.total_wallet;
    } catch (error) {
        log.error('Failed to get total wallets');
        return null;
    }
}

async function getTotalReferrals(walletAddress) {
    try {
        const response = await axios.get(`${API_BASE_URL}/referral/get-total-downline`, {
            params: { wallet_address: walletAddress },
            headers: {
                'Accept': 'application/json',
                'Origin': 'https://cult.world',
                'Referer': 'https://cult.world/'
            }
        });
        return response.data.data.total_cult;
    } catch (error) {
        log.error('Failed to get referral count');
        return null;
    }
}

async function getChallenge(walletAddress, retryCount = 0) {
    const spinner = new Spinner('Requesting challenge...').start();
    try {
        log.verbose(`Sending challenge request for wallet: ${walletAddress}`);
        const response = await axios.post(`${API_BASE_URL}/auth/challenge`, {
            wallet_address: walletAddress
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': 'https://cult.world',
                'Referer': 'https://cult.world/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
        });
        spinner.succeed('Challenge received');
        log.verbose(`Challenge: ${response.data.data.challenge}`);
        return response.data.data.challenge;
    } catch (error) {
        spinner.fail('Challenge request failed');
        if (retryCount < MAX_RETRIES) {
            log.warning(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            await sleep(RETRY_DELAY);
            return getChallenge(walletAddress, retryCount + 1);
        }
        throw error;
    }
}

async function registerWallet(wallet, challenge, referralCode, retryCount = 0) {
    const spinner = new Spinner('Registering wallet...').start();
    try {
        const signature = await wallet.signMessage(challenge);
        
        log.verbose(`Sending registration request:`);
        log.verbose(`- Wallet: ${wallet.address}`);
        log.verbose(`- Referral: ${referralCode}`);
        
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            wallet_address: wallet.address,
            challenge: challenge,
            response: signature,
            referral_code: referralCode
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': 'https://cult.world',
                'Referer': 'https://cult.world/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
        });
        spinner.succeed('Registration successful');
        log.verbose(`Response: ${JSON.stringify(response.data, null, 2)}`);
        return response.data;
    } catch (error) {
        spinner.fail('Registration failed');
        if (retryCount < MAX_RETRIES) {
            log.warning(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            await sleep(RETRY_DELAY);
            return registerWallet(wallet, challenge, referralCode, retryCount + 1);
        }
        throw error;
    }
}

function printWalletBox(walletInfo, index, total) {
    const width = 78;
    const line = '─'.repeat(width);
    console.log(`${colors.cyan}╭${line}╮${colors.reset}`);
    console.log(`${colors.cyan}│${colors.bright} Wallet ${index}/${total}${' '.repeat(width - String(`Wallet ${index}/${total}`).length - 1)}${colors.reset}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}├${line}┤${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} Address    : ${walletInfo.address}${' '.repeat(width - walletInfo.address.length - 13)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} Private Key: ${walletInfo.privateKey}${' '.repeat(width - walletInfo.privateKey.length - 13)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} Mnemonic   : ${walletInfo.mnemonic}${' '.repeat(width - walletInfo.mnemonic.length - 13)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}╰${line}╯${colors.reset}`);
}

async function displayStats(walletAddress) {
    log.title('PLATFORM STATISTICS');
    
    const spinner = new Spinner('Fetching statistics...').start();
    
    const [totalWallets, totalRefs] = await Promise.all([
        getTotalWallets(),
        getTotalReferrals(walletAddress)
    ]);
    
    spinner.stop();
    
    if (totalWallets !== null) {
        log.stats(`Total Registered Wallets: ${totalWallets.toLocaleString()}`);
    }
    if (totalRefs !== null) {
        log.stats(`Your Total Referrals: ${totalRefs}`);
    }
    console.log(); // Empty line for spacing
}

async function main() {
    try {
        log.title('CULT WORLD REGISTRATION BOT - AIRDROP INSIDERS');
        log.info('Starting registration process...\n');

        // Get user input
        const referralCode = (await question(`Enter referral code (default: ${DEFAULT_REF_CODE}): `)) || DEFAULT_REF_CODE;
        const numberOfAccounts = parseInt(await question('Enter number of accounts to create: '));
        const trackingWallet = await question('Enter wallet address to track referrals (optional): ');

        // Ask for verbose mode
        const verbose = (await question('Enable verbose logging? (y/N): ')).toLowerCase() === 'y';
        if (verbose) process.env.VERBOSE = true;

        // Display initial stats if tracking wallet provided
        if (trackingWallet) {
            await displayStats(trackingWallet);
        }

        log.title(`CREATING ${numberOfAccounts} ACCOUNTS`);
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < numberOfAccounts; i++) {
            try {
                log.info(`Processing account ${i + 1}/${numberOfAccounts}`);
                
                const wallet = ethers.Wallet.createRandom();
                log.verbose(`Generated new wallet: ${wallet.address}`);

                const challenge = await getChallenge(wallet.address);
                await sleep(1000);
                const result = await registerWallet(wallet, challenge, referralCode);
                
                const walletInfo = {
                    address: wallet.address,
                    privateKey: wallet.privateKey,
                    mnemonic: wallet.mnemonic.phrase
                };
                
                const fs = require('fs');
                fs.appendFileSync('wallets.json', JSON.stringify(walletInfo, null, 2) + '\n');
                
                printWalletBox(walletInfo, i + 1, numberOfAccounts);
                
                successCount++;
                
                if (i < numberOfAccounts - 1) {
                    log.info('Waiting before next registration...');
                    await sleep(3000);
                }
            } catch (error) {
                log.error(`Failed to register wallet ${i + 1}: ${error.message}`);
                failCount++;
                continue;
            }
        }

        // Display final stats if tracking wallet provided
        if (trackingWallet) {
            await displayStats(trackingWallet);
        }

        log.title('REGISTRATION SUMMARY');
        log.success(`Successfully registered: ${successCount} accounts`);
        if (failCount > 0) {
            log.error(`Failed registrations: ${failCount} accounts`);
        }
        log.info('Wallet information saved to wallets.json');

    } catch (error) {
        log.error(`Fatal error: ${error.message}`);
    } finally {
        rl.close();
    }
}

// Run the script
main();