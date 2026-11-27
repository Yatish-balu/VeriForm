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
import { checkBackendHealth, fetchFormsList, fetchReviewDoubts } from './api/client';
import { analyzeUploadedDocument, formatFileSize } from './utils/imageQuality';

const PAGE_TITLES = {
  '/': 'Upload B-Form',
  '/upload': 'Upload B-Form',
  '/review': 'Review Queue',
  '/rooms': 'Room Summaries',
  '/branches': 'Branch Summaries',
  '/history': 'Form History',
};

function finalizedForm(form) {
  return { ...form, status: 'final', open_doubts: 0, can_finalize: false };
}

function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, authMode, signOut } = useAuth();

  const [documentData, setDocumentData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [doubtsLoading, setDoubtsLoading] = useState(true);
  const [doubtsError, setDoubtsError] = useState('');
  const [doubtsRevision, setDoubtsRevision] = useState(0);
  const [historyForms, setHistoryForms] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyRevision, setHistoryRevision] = useState(0);
  const userId = user?.id;
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
    checkBackendHealth().then(setBackendStatus);
  }, [user]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setDoubtsLoading(true);
    setDoubtsError('');
    fetchReviewDoubts(controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setDoubts(data);
    }).catch((error) => {
      if (!controller.signal.aborted) setDoubtsError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setDoubtsLoading(false);
    });
    return () => controller.abort();
  }, [userId, doubtsRevision]);

  useEffect(() => {
    if (!userId) {
      setHistoryForms([]);
      setHistoryLoading(true);
      setHistoryError('');
      return;
    }
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError('');
    fetchFormsList(controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setHistoryForms((current) => {
        // A list request in flight can still contain a form just confirmed as final.
        const finalizedIds = new Set(current.filter((form) => form.status === 'final').map((form) => form.id));
        return data.map((form) => finalizedIds.has(form.id) ? finalizedForm(form) : form);
      });
    }).catch((error) => {
      if (!controller.signal.aborted) setHistoryError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [userId, historyRevision]);

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

  const refreshHistory = () => {
    setHistoryLoading(true);
    setHistoryRevision((revision) => revision + 1);
  };

  const handleFormFinalized = (formId) => {
    setHistoryForms((current) => current.map((form) => form.id === formId ? finalizedForm(form) : form));
  };

  const refreshDoubts = () => {
    setDoubtsLoading(true);
    setDoubtsRevision((revision) => revision + 1);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleAiDrawerUpload = async (file) => {
    setAiDrawerOpen(false);
    navigate('/upload');
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    const extAllowed = /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extAllowed) return;

    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedPreviewUrl(previewUrl);

    const analysis = await analyzeUploadedDocument(file);
    setDocumentData({
      id: `upload-${Date.now()}`,
      fileName: file.name,
      fileSizeLabel: formatFileSize(file.size),
      uploadedAtLabel: 'Uploaded just now',
      fileType: file.type || 'image/jpeg',
      isSample: false,
      qualityChecks: analysis.qualityChecks,
      warningBanner: analysis.warningBanner,
      students: [],
    });
  };

  return (
    <div className="min-h-screen flex bg-[#F7F7F5] text-[#111827]">
      <Sidebar
        activePath={location.pathname}
        onNavigate={(path) => navigate(path)}
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
                  onAddHistoryRecord={() => {
                    refreshHistory();
                    refreshDoubts();
                  }}
                  onNavigateReview={(formId) => navigate(`/review?form_id=${encodeURIComponent(formId)}`)}
                />
              }
            />
            <Route
              path="/review"
              element={
                <ReviewQueuePage
                  doubts={doubts}
                  setDoubts={setDoubts}
                  doubtsLoading={doubtsLoading}
                  doubtsError={doubtsError}
                  onRetryDoubts={refreshDoubts}
                  forms={historyForms}
                  formsLoading={historyLoading}
                  formsError={historyError}
                  onRefreshForms={refreshHistory}
                  onFormFinalized={handleFormFinalized}
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
                  loading={historyLoading}
                  error={historyError}
                  onRetry={refreshHistory}
                  onOpenUpload={() => navigate('/upload')}
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
        onUploadFile={handleAiDrawerUpload}
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
