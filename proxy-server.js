const http = require('http');
const httpProxy = require('http-proxy-middleware');

const proxy = httpProxy.createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'debug'
});

const server = http.createServer((req, res) => {
  proxy(req, res);
});

server.listen(8080, () => {
  console.log('Proxy server running on port 8080');
  console.log('Forwarding requests to localhost:3000');
});
