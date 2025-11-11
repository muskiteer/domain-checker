export default function Home() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>Domain Checker API</h1>
      <p>Simple API to check domain availability and reachability.</p>
      
      <h2>Endpoint</h2>
      <code>POST /api/check-domain</code>
      
      <h3>Example Request</h3>
      <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '4px' }}>
{`curl -X POST "https://domain-checker-gray.vercel.app/api/check-domain" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"example.com"}'`}
      </pre>
      
      <h3>Response</h3>
      <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '4px' }}>
{`{
  "domain": "example.com",
  "dns_resolves": true,
  "ip": "93.184.216.34",
  "http": {
    "ok": true,
    "status_code": 200,
    "url": "http://example.com/"
  },
  "https": {
    "ok": true,
    "status_code": 200,
    "url": "https://example.com/"
  }
}`}
      </pre>
    </div>
  );
}
