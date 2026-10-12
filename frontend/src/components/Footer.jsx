export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>© {new Date().getFullYear()} ShopKart. A full-stack customer authentication project.</p>
        <p className="footer__meta">React · Express · MongoDB · JWT</p>
      </div>
    </footer>
  );
}
