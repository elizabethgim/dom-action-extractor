import { Routes, Route } from "react-router";
import SettingsPage from "./SettingsPage";
import AiPage from "./AiPage";
import DebugPage from "./DebugPage";
import SystemPage from "./SystemPage";
import AnimationPage from "./AnimationPage";
import ChartCodeEditorPage from "./ChartCodeEditor";

export default function App() {
  return (
    <div className="builder-layout">
      <Routes>
        <Route path="/" element={<SystemPage />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/animation" element={<AnimationPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/registry" element={<ChartCodeEditorPage />} />
      </Routes>
    </div>
  );
}
