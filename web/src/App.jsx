import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { homeFor } from './lib/format';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import PatientHome from './pages/patient/Home';
import PatientHistory from './pages/patient/History';
import PatientPlans from './pages/patient/Plans';
import PatientDiet from './pages/patient/DietPlan';
import Queue from './pages/staff/Queue';
import PlansAdmin from './pages/staff/PlansAdmin';
import PatientCase from './pages/staff/PatientCase';
import MyPatients from './pages/staff/MyPatients';
import Dashboard from './pages/doctor/Dashboard';
import Team from './pages/doctor/Team';
import Reviews from './pages/doctor/Reviews';
import Audit from './pages/doctor/Audit';

function Guard({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to={homeFor(user.role)} replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  if (user.mustChangePassword) return <ChangePassword />;

  const P = ['PATIENT'], S = ['CARE_TEAM', 'LEAD_DOCTOR'], D = ['DIETITIAN'], L = ['LEAD_DOCTOR'], C = ['CARE_TEAM'];
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={user.role === 'PATIENT' ? <PatientHome /> : <Navigate to={homeFor(user.role)} replace />} />
        <Route path="/history" element={<Guard roles={P}><PatientHistory /></Guard>} />
        <Route path="/plans" element={<Guard roles={P}><PatientPlans /></Guard>} />
        <Route path="/my-plan" element={<Guard roles={P}><PatientDiet /></Guard>} />
        <Route path="/queue" element={<Guard roles={S}><Queue /></Guard>} />
        <Route path="/plans-admin" element={<Guard roles={C}><PlansAdmin /></Guard>} />
        <Route path="/patients" element={<Guard roles={D}><MyPatients /></Guard>} />
        <Route path="/patient/:id" element={<Guard roles={['CARE_TEAM', 'DIETITIAN', 'LEAD_DOCTOR']}><PatientCase /></Guard>} />
        <Route path="/dashboard" element={<Guard roles={L}><Dashboard /></Guard>} />
        <Route path="/team" element={<Guard roles={L}><Team /></Guard>} />
        <Route path="/reviews" element={<Guard roles={L}><Reviews /></Guard>} />
        <Route path="/audit" element={<Guard roles={L}><Audit /></Guard>} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Route>
    </Routes>
  );
}
