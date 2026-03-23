// Always use stub during build to prevent WDK module loading
const WDKClient = require('./WDKClient.stub').WDKClient;

export { WDKClient };
export default WDKClient;