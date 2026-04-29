import { useState, useCallback } from 'react';

const STORAGE_KEY = 'distributor-intel-profiles';
const TIER_COLORS = { High: '#16a34a', Mid: '#d97706', Low: '#dc2626' };

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

// ── Tier badge ──────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  const color = TIER_COLORS[tier] || '#64748b';
  return (
    <span className="tier-badge" style={{ background: color }}>
      {tier} Priority
    </span>
  );
}

// ── Tag list ─────────────────────────────────────────────────────────────────

function Tags({ items, accent }) {
  if (!items?.length) return <span className="muted">—</span>;
  return (
    <div className="tags">
      {items.map((item) => (
        <span key={item} className="tag" style={{ borderColor: accent }}>
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Full profile card ─────────────────────────────────────────────────────────

function ProfileCard({ profile, isSaved, onSave }) {
  const [notes, setNotes] = useState(profile.notes || '');
  const [savedNow, setSavedNow] = useState(isSaved);

  const handleSave = () => {
    onSave({ ...profile, notes });
    setSavedNow(true);
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    setSavedNow(false);
  };

  return (
    <div className="profile-card">
      {/* Header */}
      <div className="profile-header">
        <div>
          <h2 className="profile-name">{profile.name}</h2>
          <div className="profile-meta">
            {profile.location && <span>{profile.location}</span>}
            {profile.founded && <span>Est. {profile.founded}</span>}
            {profile.size && (
              <span className={`size-badge size-${profile.size}`}>
                {profile.size.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <TierBadge tier={profile.tier} />
      </div>

      {/* Summary */}
      <p className="profile-summary">{profile.summary}</p>

      {/* Key stats */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-label">Annual Volume</div>
          <div className="stat-value">{profile.volume || '—'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Sales Reps</div>
          <div className="stat-value">{profile.reps || '—'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Specialty</div>
          <div className="stat-value">{profile.specialty || '—'}</div>
        </div>
      </div>

      {/* Categories */}
      <div className="field-group">
        <div className="field-label">Product Categories</div>
        <Tags items={profile.categories} accent="#2563eb" />
      </div>

      {/* Geography */}
      <div className="field-group">
        <div className="field-label">Geography Served</div>
        <Tags items={profile.geography} accent="#7c3aed" />
      </div>

      {/* Online */}
      <div className="field-group">
        <div className="field-label">Online Presence</div>
        <p className="field-text">{profile.online || '—'}</p>
      </div>

      {/* Notes */}
      <div className="field-group">
        <div className="field-label">Call Notes</div>
        <textarea
          className="notes-area"
          rows={4}
          placeholder="Add your own notes about this distributor, talking points, follow-ups..."
          value={notes}
          onChange={handleNotesChange}
        />
      </div>

      {/* Actions */}
      <div className="card-actions">
        <button
          className={`btn-save ${savedNow ? 'btn-save--saved' : ''}`}
          onClick={handleSave}
        >
          {savedNow ? '✓ Saved' : 'Save Profile'}
        </button>
        {profile.researchedAt && (
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Researched {new Date(profile.researchedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Compact saved-profile card ────────────────────────────────────────────────

function SavedCard({ profile, onSelect, onDelete }) {
  const color = TIER_COLORS[profile.tier] || '#64748b';
  const preview = profile.summary?.slice(0, 110);

  return (
    <div className="saved-card">
      <div className="saved-card-top">
        <h3 className="saved-card-name">{profile.name}</h3>
        <span className="tier-dot" style={{ background: color }} title={`${profile.tier} Priority`} />
      </div>
      <div className="saved-card-loc">{profile.location}</div>
      <p className="saved-card-preview">{preview}{profile.summary?.length > 110 ? '…' : ''}</p>
      <div className="saved-card-footer">
        <button className="btn-view" onClick={() => onSelect(profile)}>
          View Profile
        </button>
        <button className="btn-delete" onClick={() => onDelete(profile.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState('research');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState(loadProfiles);
  const [selectedSaved, setSelectedSaved] = useState(null);

  const isSaved = currentProfile
    ? savedProfiles.some((p) => p.id === currentProfile.id)
    : false;

  const handleResearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setCurrentProfile(null);

    try {
      const res = await fetch('/.netlify/functions/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCurrentProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback((profile) => {
    setSavedProfiles((prev) => {
      const updated = [...prev.filter((p) => p.id !== profile.id), profile];
      persistProfiles(updated);
      return updated;
    });
    setSelectedSaved((prev) => (prev?.id === profile.id ? profile : prev));
  }, []);

  const handleDelete = useCallback((id) => {
    setSavedProfiles((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      persistProfiles(updated);
      return updated;
    });
    setSelectedSaved((prev) => (prev?.id === id ? null : prev));
  }, []);

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-name">Distributor Intel</span>
          </div>
          <nav className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'research' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('research')}
            >
              Research
            </button>
            <button
              className={`tab-btn ${activeTab === 'saved' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              Saved Profiles
              {savedProfiles.length > 0 && (
                <span className="tab-count">{savedProfiles.length}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="app-main">

        {/* Research tab */}
        {activeTab === 'research' && (
          <div>
            <div className="search-section">
              <h1 className="page-title">Research a Distributor</h1>
              <p className="page-sub">
                Enter a distributor name to generate an AI-powered sales intelligence profile
                using live web research.
              </p>
              <div className="search-bar">
                <input
                  className="search-input"
                  type="text"
                  placeholder="e.g. 4imprint, Cimpress, Amsterdam Printing…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                  disabled={loading}
                />
                <button
                  className="btn-research"
                  onClick={handleResearch}
                  disabled={loading || !query.trim()}
                >
                  {loading ? 'Researching…' : 'Research'}
                </button>
              </div>
            </div>

            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                <p>Researching <strong>{query}</strong> — this usually takes 15–30 seconds.</p>
              </div>
            )}

            {error && (
              <div className="error-box">
                <strong>Research failed:</strong> {error}
              </div>
            )}

            {currentProfile && !loading && (
              <ProfileCard
                key={currentProfile.id}
                profile={currentProfile}
                isSaved={isSaved}
                onSave={handleSave}
              />
            )}
          </div>
        )}

        {/* Saved profiles tab */}
        {activeTab === 'saved' && (
          <div>
            {selectedSaved ? (
              <div>
                <button className="btn-back" onClick={() => setSelectedSaved(null)}>
                  ← Back to Saved Profiles
                </button>
                <ProfileCard
                  key={selectedSaved.id}
                  profile={selectedSaved}
                  isSaved={true}
                  onSave={handleSave}
                />
              </div>
            ) : (
              <div>
                <div className="saved-header">
                  <h1 className="page-title">Saved Profiles</h1>
                  <span className="muted">{savedProfiles.length} saved</span>
                </div>
                {savedProfiles.length === 0 ? (
                  <div className="empty-state">
                    <p>No profiles saved yet.</p>
                    <p className="muted">
                      Research a distributor and click "Save Profile" to see it here.
                    </p>
                  </div>
                ) : (
                  <div className="saved-grid">
                    {[...savedProfiles].reverse().map((p) => (
                      <SavedCard
                        key={p.id}
                        profile={p}
                        onSelect={setSelectedSaved}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
