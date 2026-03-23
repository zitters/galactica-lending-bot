// Build-time stub for WDKClient to prevent module loading during build
export class WDKClient {
  static async getBalance() {
    return { usdt: 100000, xaut: 25, btc: 5.5 };
  }

  static async transfer() {
    throw new Error('WDK not available during build');
  }

  static async getWalletAddress() {
    return '0x0000000000000000000000000000000000000000';
  }

  static async executeLoan() {
    throw new Error('WDK not available during build');
  }
}

export default WDKClient;