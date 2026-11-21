export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    boxShadow: { panel: '0 1px 2px rgba(10,37,64,.06), 0 1px 1px rgba(10,37,64,.04)' },
    fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'] },
    colors: { brand: { 50:'#eef4fa',100:'#d9e6f3',500:'#1f5f99',600:'#174c7c',700:'#103a60',900:'#0a2540' }, amber: { 500:'#f2a900', 600:'#d99400' } }
  } },
  plugins: []
}
