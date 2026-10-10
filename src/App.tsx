import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import CustomerProfilePage from './pages/CustomerProfilePage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import InventoryPage from './pages/InventoryPage'
import LoginPage from './pages/LoginPage'
import LogisticsPage from './pages/LogisticsPage'
import OrdersPage from './pages/OrdersPage'
import OtpPage from './pages/OtpPage'
import PaymentsPage from './pages/PaymentsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ServicesPage from './pages/ServicesPage'
import StaffPage from './pages/StaffPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
          <Route path="/pickup-delivery" element={<LogisticsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<OtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
