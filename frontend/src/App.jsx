import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import GuestRoute from './components/GuestRoute.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetails from './pages/OrderDetails.jsx';
import NotFound from './pages/NotFound.jsx';

const protectedPages = [
  ['/home', <Home />],
  ['/wishlist', <Wishlist />],
  ['/cart', <Cart />],
  ['/checkout', <Checkout />],
  ['/order-success/:id', <OrderSuccess />],
  ['/orders', <Orders />],
  ['/orders/:id', <OrderDetails />],
];

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="app-shell">
          <Navbar />
          <main id="main" className="app-main" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Navigate to="/products" replace />} />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <Register />
                  </GuestRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetails />} />
              {protectedPages.map(([path, page]) => (
                <Route key={path} path={path} element={<ProtectedRoute>{page}</ProtectedRoute>} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
