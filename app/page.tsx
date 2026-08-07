/**
 * A minimal landing page. Not required for MCP to work -- but when someone
 * pastes your server URL into a browser to check it is alive, this is what
 * they get instead of a 404.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '42rem', margin: '4rem auto', padding: '0 1.5rem', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>MCP Server</h1>
      <p style={{ color: '#555' }}>
        This is a Model Context Protocol endpoint, not a website. Connect an
        MCP-compatible client to it rather than browsing here.
      </p>

      <h2 style={{ fontSize: '1rem', marginTop: '2rem' }}>Connect</h2>
      <p style={{ color: '#555' }}>Add this URL as a custom connector in your MCP client:</p>
      <pre style={{ background: '#f4f4f5', padding: '0.75rem 1rem', borderRadius: '0.375rem', overflowX: 'auto' }}>
        <code>{process.env.SERVER_HOST ?? 'https://your-deployment-url'}/mcp</code>
      </pre>
      <p style={{ color: '#555' }}>
        You will be sent to sign in, and asked to approve the access the server
        is requesting. If your organization uses SSO, you will be routed to your
        own identity provider automatically.
      </p>
    </main>
  );
}
