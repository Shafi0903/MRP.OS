import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { LoginPage } from '../features/auth/LoginPage';
import { ExecutiveDashboard } from '../features/dashboard/ExecutiveDashboard';
import { MaterialListPage } from '../features/materials/MaterialListPage';
import { ProductListPage } from '../features/products/ProductListPage';
import { SupplierListPage } from '../features/suppliers/SupplierListPage';
import { BomStructureView } from '../features/bom/BomStructureView';
import { ProductionListPage } from '../features/production/ProductionListPage';
import { ProcurementListPage } from '../features/procurement/ProcurementListPage';
import { MrpProposalsPage } from '../features/mrp/MrpProposalsPage';

export function App() {
  const [currentUser, setCurrentUser] = useState({
    name: 'Production Planner',
    email: 'planner.chakan@tatamotors-mrp.in',
    role: 'Production Planner (Chakan Plant)',
    facility: 'Pune Chakan Plant',
  });
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (!currentUser) {
    return <LoginPage onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex font-sans text-slate-900 antialiased">
      {/* Collapsible Modern Left Sidebar (Matching Images 1 & 3) */}
      <Sidebar currentTab={currentTab} onNavigate={setCurrentTab} />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header 
          currentTab={currentTab} 
          onNavigate={setCurrentTab} 
          user={currentUser}
          onLogout={() => setCurrentUser(null)}
        />

        {/* Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
          {currentTab === 'dashboard' && (
            <ExecutiveDashboard onNavigate={setCurrentTab} />
          )}
          {currentTab === 'production' && (
            <ProductionListPage />
          )}
          {currentTab === 'procurement' && (
            <ProcurementListPage />
          )}
          {currentTab === 'mrp' && (
            <MrpProposalsPage onNavigate={setCurrentTab} />
          )}
          {currentTab === 'bom' && (
            <BomStructureView onNavigate={setCurrentTab} />
          )}
          {currentTab === 'materials' && (
            <MaterialListPage />
          )}
          {currentTab === 'products' && (
            <ProductListPage />
          )}
          {currentTab === 'suppliers' && (
            <SupplierListPage />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
