import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import GuestOnly from './components/auth/GuestOnly'
import RequireAuth from './components/auth/RequireAuth'
import AppLayout from './components/layout/AppLayout'
import BranchDetailPage from './pages/BranchDetailPage'
import BranchesPage from './pages/BranchesPage'
import CustomerProfilePage from './pages/CustomerProfilePage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import InventoryPage from './pages/InventoryPage'
import LoginPage from './pages/LoginPage'
import MachineDetailPage from './pages/MachineDetailPage'
import MachinesPage from './pages/MachinesPage'
import NotificationsPage from './pages/NotificationsPage'
import OperationsPage from './pages/OperationsPage'
import LogisticsPage from './pages/LogisticsPage'
import OrdersPage from './pages/OrdersPage'
import OtpPage from './pages/OtpPage'
import PaymentsPage from './pages/PaymentsPage'
import PlatformPlansPage from './pages/PlatformPlansPage'
import PricingPage from './pages/PricingPage'
import PromotionsPage from './pages/PromotionsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ServicesPage from './pages/ServicesPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'
import SubscriptionPlansPage from './pages/SubscriptionPlansPage'
import TenantsPage from './pages/TenantsPage'
import useSettings from './hooks/useSettings'
import { applySettings, watchSystemTheme } from './utils/settings'

function App() {
  const settings = useSettings()

  useEffect(() => {
    applySettings(settings)
    // The System theme follows the device while the app is open
    return watchSystemTheme(() => applySettings(settings))
  }, [settings])

  return (
    <BrowserRouter>
      <Routes>
        {/* Signed-in pages */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
            <Route path="/pickup-delivery" element={<LogisticsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/branches/:branchId" element={<BranchDetailPage />} />
            <Route path="/machines" element={<MachinesPage />} />
            <Route path="/machines/:machineId" element={<MachineDetailPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/pricing/subscriptions" element={<SubscriptionPlansPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/platform/plans" element={<PlatformPlansPage />} />
          </Route>
        </Route>
        {/* Sign-in and recovery: signed-in users are sent to the app */}
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<OtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        {/* RequireAuth sends signed-out users on to /login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
