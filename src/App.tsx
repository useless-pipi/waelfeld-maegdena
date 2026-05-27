import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { applyUiScale, readUiScale, SETTINGS_CHANGED_EVENT } from './utils/settings';
import Layout from './components/Layout';
import Home from './pages/Home';
import Members from './pages/Members';
import Composition from './pages/Composition';
import Missions from './pages/Missions';
import Recruits from './pages/Recruits';
import Buildings from './pages/Buildings';
import EquipmentPage from './pages/EquipmentPage';
import SavePage from './pages/Save';
import Credits from './pages/Credits';
import Admin from './pages/Admin';
import Rules from './pages/Rules';
import DevAnalysis from './pages/DevAnalysis';
import HowToPlay from './pages/HowToPlay';
import Balance from './pages/Balance';
import RuleEngine from './pages/RuleEngine';
import SettingsPage from './pages/Settings';
import ThreatReview from './pages/ThreatReview';

function App() {
  useEffect(() => {
    applyUiScale(readUiScale());
    const handler = () => applyUiScale(readUiScale());
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="members" element={<Members />} />
          <Route path="composition" element={<Composition />} />
          <Route path="missions" element={<Missions />} />
          <Route path="recruits" element={<Recruits />} />
          <Route path="buildings" element={<Buildings />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="save" element={<SavePage />} />
          <Route path="credits" element={<Credits />} />
          <Route path="rules" element={<Rules />} />
          <Route path="howtoplay" element={<HowToPlay />} />
          {!import.meta.env.PROD && <Route path="ruleengine" element={<RuleEngine />} />}
          {!import.meta.env.PROD && <Route path="balance" element={<Balance />} />}
          {!import.meta.env.PROD && <Route path="admin" element={<Admin />} />}
          {!import.meta.env.PROD && <Route path="devanalysis" element={<DevAnalysis />} />}
          {!import.meta.env.PROD && <Route path="threatreview" element={<ThreatReview />} />}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
