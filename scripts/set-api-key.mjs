import Conf from 'conf';

const host = process.env.N8N_API_URL;
const apiKey = process.env.N8N_API_KEY;
if (!host || !apiKey) {
  console.error('N8N_API_URL and N8N_API_KEY must be set (source .env first)');
  process.exit(1);
}

const store = new Conf({ projectName: 'n8nac', configName: 'credentials' });
const hosts = store.get('hosts') || {};
hosts[new URL(host).origin] = apiKey;
store.set('hosts', hosts);
console.log('Saved n8nac credential for', new URL(host).origin);
