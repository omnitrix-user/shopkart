export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>© {new Date().getFullYear()} ShopKart. Payments run in Razorpay Test Mode — no real money is charged.</p>
        <p className="footer__meta">React · Express · MongoDB · JWT</p>
      </div>
    </footer>
  );
}
