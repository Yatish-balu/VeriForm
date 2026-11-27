import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import AskAIDrawer from './components/AskAIDrawer';
import HelpModal from './components/HelpModal';
import LoginPage from './pages/LoginPage';
import UploadBFormPage from './pages/UploadBFormPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import RoomSummariesPage from './pages/RoomSummariesPage';
import BranchSummariesPage from './pages/BranchSummariesPage';
import FormHistoryPage from './pages/FormHistoryPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WORKSPACES } from './data/mockData';
import { checkBackendHealth, fetchFormsList, fetchReviewDoubts } from './api/client';

const PAGE_TITLES = {
  '/': 'Upload B-Form',
  '/upload': 'Upload B-Form',
  '/review': 'Review Queue',
  '/rooms': 'Room Summaries',
  '/branches': 'Branch Summaries',
  '/history': 'Form History',
};

function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, authMode, signOut } = useAuth();

  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [documentData, setDocumentData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [historyForms, setHistoryForms] = useState([]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState({
    connected: false,
    mode: 'live',
    detail: 'Checking…',
  });

  useEffect(() => {
    if (!user) return;
    checkBackendHealth().then((status) => {
      setBackendStatus(status);
      if (status.connected) {
        fetchReviewDoubts()
          .then((res) => {
            if (res?.data) setDoubts(res.data);
          })
          .catch(() => {});
        fetchFormsList()
          .then((res) => {
            if (res?.data) setHistoryForms(res.data);
          })
          .catch(() => {});
      }
    });
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#64748B]">
          <span className="w-4 h-4 border-2 border-[#293F2D] border-t-transparent rounded-full animate-spin" />
          <span>Loading session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const openDoubtsCount = doubts.filter((d) => !d.resolved).length;
  const pageTitle = PAGE_TITLES[location.pathname] || 'Upload B-Form';

  const handleAddHistoryRecord = (form, fileName) => {
    setHistoryForms((prev) => {
      if (prev.some((f) => f.file_name === fileName)) return prev;
      return [
        {
          id: form.id || `form-${Date.now()}`,
          file_name: fileName,
          room_no: form.room_no || 'CDS 105',
          exam_name: form.exam_name || 'CIA Test-III',
          status: form.status || 'needs_review',
          open_doubts: 1,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const handleMarkFormFinal = (formId) => {
    setHistoryForms((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, status: 'final', open_doubts: 0 } : f))
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-[#F7F7F5] text-[#111827]">
      <Sidebar
        activePath={location.pathname}
        onNavigate={(path) => navigate(path)}
        workspaces={WORKSPACES}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        openDoubtsCount={openDoubtsCount}
        onOpenHelp={() => setHelpModalOpen(true)}
        backendStatus={backendStatus}
        userEmail={user?.email}
        authMode={authMode}
        onSignOut={handleSignOut}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          pageTitle={pageTitle}
          onOpenAI={() => setAiDrawerOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route
              path="/upload"
              element={
                <UploadBFormPage
                  documentData={documentData}
                  setDocumentData={setDocumentData}
                  uploadedFile={uploadedFile}
                  setUploadedFile={setUploadedFile}
                  uploadedPreviewUrl={uploadedPreviewUrl}
                  setUploadedPreviewUrl={setUploadedPreviewUrl}
                  onAddHistoryRecord={handleAddHistoryRecord}
                  onNavigateReview={() => navigate('/review')}
                />
              }
            />
            <Route
              path="/review"
              element={
                <ReviewQueuePage
                  doubts={doubts}
                  setDoubts={setDoubts}
                  onMarkFormFinal={handleMarkFormFinal}
                />
              }
            />
            <Route path="/rooms" element={<RoomSummariesPage />} />
            <Route path="/branches" element={<BranchSummariesPage />} />
            <Route
              path="/history"
              element={
                <FormHistoryPage
                  forms={historyForms}
                  onOpenUpload={() => navigate('/upload')}
                  onOpenReview={() => navigate('/review')}
                />
              }
            />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </main>
      </div>

      <AskAIDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        currentSheet={documentData}
        openDoubtsCount={openDoubtsCount}
        backendStatus={backendStatus}
      />

      <HelpModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<WorkspaceShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
